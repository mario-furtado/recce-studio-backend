package org.example.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.dto.ClickMarkerDto;
import org.example.dto.NewPecDTO;
import org.example.dto.OfflineRecceSyncRequestDTO;
import org.example.dto.OfflineRecceSyncResponseDTO;
import org.example.dto.PecDTO;
import org.example.entity.NoteEntity;
import org.example.entity.OfflineRecceSyncEntity;
import org.example.entity.PecEntity;
import org.example.repository.OfflineRecceSyncRepository;
import org.example.repository.PecRepository;
import org.example.repository.AuthUserRepository;
import org.example.controller.TenantContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class OfflineRecceSyncService {
    private final OfflineRecceSyncRepository syncRepository;
    private final PecRepository pecRepository;
    private final PecService pecService;
    private final NoteExcelParserService noteService;
    private final ObjectMapper objectMapper;
    private final TenantContext tenantContext;
    private final RallyWriteGuard writes;
    private final AuthUserRepository users;
    private final PecAssetService assets;
    private final Clock clock;

    public OfflineRecceSyncService(
            OfflineRecceSyncRepository syncRepository,
            PecRepository pecRepository,
            PecService pecService,
            NoteExcelParserService noteService,
            ObjectMapper objectMapper,
            TenantContext tenantContext,
            RallyWriteGuard writes, AuthUserRepository users, PecAssetService assets, Clock clock) {
        this.syncRepository = syncRepository;
        this.pecRepository = pecRepository;
        this.pecService = pecService;
        this.noteService = noteService;
        this.objectMapper = objectMapper;
        this.tenantContext = tenantContext;
        this.writes = writes;
        this.users = users;
        this.assets = assets;
        this.clock = clock;
    }

    @Transactional
    public OfflineRecceSyncResponseDTO sync(OfflineRecceSyncRequestDTO request, boolean explicitCrew) {
        if (request == null) throw new IllegalArgumentException("Pedido de sincronizacao invalido.");
        requireContext(request.getAccountId(), request.getCrewId(), explicitCrew);
        validateRequest(request);
        String teamProfileId = tenantContext.requireTeamProfileId();
        String owner = tenantContext.requireAccountId();
        lockAccount();
        String destination = destination(request);
        if (syncRepository.countOtherContexts(request.getSessionId(), owner, tenantContext.requireUserEmail(), teamProfileId) > 0) {
            throw new AccountFlowException(HttpStatus.CONFLICT, "A sessão já tem um destino noutra tripulação.");
        }
        OfflineRecceSyncEntity existingSync = syncRepository
                .findByOfflineSessionIdAndTeamProfileId(request.getSessionId(), teamProfileId)
                .orElse(null);
        if (existingSync != null) {
            PecEntity pec = requireReceiptDestination(existingSync);
            boolean sameDestination = pec.getId().equals(request.getPecId())
                    || destination.equals(existingSync.getRequestedDestination());
            if (!sameDestination) throw new AccountFlowException(HttpStatus.CONFLICT, "A sessão já tem um destino. Repete o envio para o destino original.");
            return toResponse(existingSync);
        }

        String pecId = resolvePecId(request);
        List<ClickMarkerDto> markers = request.getMarkers() != null
                ? request.getMarkers()
                : Collections.emptyList();

        List<NoteEntity> savedNotes = noteService.syncRecceTimestamps(pecId, markers);
        PecEntity pec = pecRepository.findByIdAndRallyTeamProfileId(pecId, teamProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("PEC nao encontrada com ID: " + pecId));
        pec.setTotalNotes(savedNotes.size());
        pec.setUpdatedAt(LocalDate.now());
        pecRepository.save(pec);

        OfflineRecceSyncEntity sync = new OfflineRecceSyncEntity();
        sync.setId(UUID.randomUUID().toString());
        sync.setOfflineSessionId(request.getSessionId());
        sync.setDeviceId(request.getDeviceId());
        sync.setUserEmail(tenantContext.requireUserEmail());
        sync.setTeamProfileId(teamProfileId);
        sync.setOwnerAccountId(owner);
        sync.setRequestedDestination(destination);
        sync.setTemporaryName(request.getTemporaryName());
        sync.setPecId(pecId);
        sync.setPecName(pec.getName());
        sync.setCreatedAtClient(request.getCreatedAt());
        sync.setFinishedAtClient(request.getFinishedAt());
        sync.setNotesCount(savedNotes.size());
        sync.setDurationSeconds(request.getDurationSeconds() != null ? request.getDurationSeconds() : 0.0);
        sync.setMarkersJson(toJson(markers));
        sync.setGpsTrackJson(toJson(request.getGpsTrack() != null ? request.getGpsTrack() : Collections.emptyList()));
        sync.setSyncedAt(LocalDateTime.now());
        syncRepository.save(sync);

        return toResponse(sync);
    }

    @Transactional
    public void uploadAudio(String receiptId, String accountId, String crewId, MultipartFile file) {
        requireContext(accountId, crewId, true);
        lockAccount();
        OfflineRecceSyncEntity receipt = syncRepository.findById(receiptId)
                .orElseThrow(OfflineRecceSyncService::unavailable);
        PecEntity pec = requireReceiptDestination(receipt);
        if (receipt.isAudioReceived()) return;
        assets.saveAudio(pec.getId(), file);
        receipt.setAudioReceived(true);
    }

    private void lockAccount() {
        String account = tenantContext.requireAccountId();
        String token = tenantContext.requireBearerToken();
        if (!users.lockById(account).isPresent()
                || !users.existsByIdAndTokenAndActiveTrueAndTokenExpiresAtEpochMillisGreaterThan(account, token, clock.millis())) {
            throw new AccountFlowException(HttpStatus.UNAUTHORIZED, "Sessão inválida ou expirada.");
        }
    }

    private void requireContext(String accountId, String crewId, boolean required) {
        if (required && (!hasText(accountId) || !hasText(crewId))) {
            throw new AccountFlowException(HttpStatus.FORBIDDEN, "Atualiza a aplicação antes de sincronizar nesta tripulação.");
        }
        if ((accountId != null || crewId != null) && (!tenantContext.requireAccountId().equals(accountId)
                || !tenantContext.requireTeamProfileId().equals(crewId))) {
            throw unavailable();
        }
    }

    private PecEntity requireReceiptDestination(OfflineRecceSyncEntity receipt) {
        String team = tenantContext.requireTeamProfileId();
        boolean ownerMatches = receipt.getOwnerAccountId() != null
                ? receipt.getOwnerAccountId().equals(tenantContext.requireAccountId())
                : tenantContext.requireUserEmail().equalsIgnoreCase(receipt.getUserEmail());
        if (!team.equals(receipt.getTeamProfileId()) || !ownerMatches) throw unavailable();
        PecEntity pec = pecRepository.findByIdAndRallyTeamProfileId(receipt.getPecId(), team)
                .orElseThrow(OfflineRecceSyncService::unavailable);
        writes.requireWritable(pec.getRally());
        if ("COMPLETED".equalsIgnoreCase(pec.getStatus()) || "COMPLETED".equalsIgnoreCase(pec.getRally().getStatus())) {
            throw new AccountFlowException(HttpStatus.CONFLICT, "A PEC ou o rali está concluído. Reabre o destino antes de sincronizar.");
        }
        if (!syncRepository.findTopByPecIdAndTeamProfileIdOrderBySyncedAtDescIdDesc(pec.getId(), team)
                .map(latest -> latest.getId().equals(receipt.getId())).orElse(false)) {
            throw new AccountFlowException(HttpStatus.CONFLICT, "A PEC já recebeu outro reconhecimento. A gravação original fica no dispositivo.");
        }
        return pec;
    }

    private String destination(OfflineRecceSyncRequestDTO request) {
        String result = hasText(request.getPecId()) ? "pec:" + request.getPecId()
                : "rally:" + request.getRallyId() + ":" + toJson(request.getNewPec());
        if (result.length() > 2048) throw new IllegalArgumentException("O destino excede o tamanho permitido.");
        return result;
    }

    private static ResourceNotFoundException unavailable() {
        return new ResourceNotFoundException("Sessão ou destino indisponível para esta conta.");
    }

    private String resolvePecId(OfflineRecceSyncRequestDTO request) {
        if (hasText(request.getPecId())) {
            return pecRepository.findByIdAndRallyTeamProfileId(
                            request.getPecId(), tenantContext.requireTeamProfileId())
                    .map(PecEntity::getId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "PEC nao encontrada com ID: " + request.getPecId()));
        }

        if (!hasText(request.getRallyId()) || request.getNewPec() == null) {
            throw new IllegalArgumentException("Escolha uma PEC existente ou envie os dados para criar uma nova PEC.");
        }

        NewPecDTO newPec = request.getNewPec();
        if (!hasText(newPec.getName())) {
            throw new IllegalArgumentException("O nome da nova PEC e obrigatorio.");
        }

        PecDTO created = pecService.createPec(request.getRallyId(), newPec);
        return created.getId();
    }

    private void validateRequest(OfflineRecceSyncRequestDTO request) {
        if (!hasText(request.getSessionId())) {
            throw new IllegalArgumentException("A sessao offline precisa de identificador.");
        }
        if (request.getSessionId().length() > 255
                || (hasText(request.getPecId()) && (hasText(request.getRallyId()) || request.getNewPec() != null))) {
            throw new IllegalArgumentException("Indica uma sessão e um único destino.");
        }
        if (request.getGpsTrack() != null) {
            for (org.example.dto.GpsPointDTO point : request.getGpsTrack()) {
                if (point == null || point.getLat() == null || point.getLng() == null
                        || !Double.isFinite(point.getLat()) || !Double.isFinite(point.getLng())
                        || Math.abs(point.getLat()) > 90 || Math.abs(point.getLng()) > 180
                        || (point.getTimestamp() != null && (!Double.isFinite(point.getTimestamp()) || point.getTimestamp() < 0))) {
                    throw new IllegalArgumentException("Amostra GPS invalida.");
                }
            }
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Erro ao serializar dados offline.", e);
        }
    }

    private OfflineRecceSyncResponseDTO toResponse(OfflineRecceSyncEntity sync) {
        OfflineRecceSyncResponseDTO response = new OfflineRecceSyncResponseDTO();
        response.setSyncId(sync.getId());
        response.setOfflineSessionId(sync.getOfflineSessionId());
        response.setPecId(sync.getPecId());
        response.setPecName(sync.getPecName());
        response.setNotesCount(sync.getNotesCount());
        response.setSyncedAt(sync.getSyncedAt().toString());
        return response;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
