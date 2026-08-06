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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
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

    public OfflineRecceSyncService(
            OfflineRecceSyncRepository syncRepository,
            PecRepository pecRepository,
            PecService pecService,
            NoteExcelParserService noteService,
            ObjectMapper objectMapper) {
        this.syncRepository = syncRepository;
        this.pecRepository = pecRepository;
        this.pecService = pecService;
        this.noteService = noteService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public OfflineRecceSyncResponseDTO sync(OfflineRecceSyncRequestDTO request) {
        validateRequest(request);
        OfflineRecceSyncEntity existingSync = syncRepository.findByOfflineSessionId(request.getSessionId()).orElse(null);
        if (existingSync != null) {
            return toResponse(existingSync);
        }

        String pecId = resolvePecId(request);
        List<ClickMarkerDto> markers = request.getMarkers() != null
                ? request.getMarkers()
                : Collections.emptyList();

        List<NoteEntity> savedNotes = noteService.syncRecceTimestamps(pecId, markers);
        PecEntity pec = pecRepository.findById(pecId)
                .orElseThrow(() -> new RuntimeException("PEC nao encontrada com ID: " + pecId));
        pec.setTotalNotes(savedNotes.size());
        pec.setUpdatedAt(LocalDate.now());
        pecRepository.save(pec);

        OfflineRecceSyncEntity sync = new OfflineRecceSyncEntity();
        sync.setId(UUID.randomUUID().toString());
        sync.setOfflineSessionId(request.getSessionId());
        sync.setDeviceId(request.getDeviceId());
        sync.setUserEmail(request.getUserEmail());
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

    private String resolvePecId(OfflineRecceSyncRequestDTO request) {
        if (hasText(request.getPecId())) {
            if (!pecRepository.existsById(request.getPecId())) {
                throw new RuntimeException("PEC nao encontrada com ID: " + request.getPecId());
            }
            return request.getPecId();
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
        if (request == null) {
            throw new IllegalArgumentException("Pedido de sincronizacao invalido.");
        }
        if (!hasText(request.getSessionId())) {
            throw new IllegalArgumentException("A sessao offline precisa de identificador.");
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
