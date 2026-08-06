package org.example.service;

import org.example.dto.NewPecDTO;
import org.example.dto.PecDTO;
import org.example.dto.PecOverviewDTO;
import org.example.dto.PecPatchDTO;
import org.example.entity.PecEntity;
import org.example.entity.RallyEntity;
import org.example.repository.NoteRepository;
import org.example.repository.PecRepository;
import org.example.repository.RallyRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PecService {

    private final PecRepository pecRepository;
    private final RallyRepository rallyRepository;
    private final NoteRepository noteRepository;

    public PecService(PecRepository pecRepository, RallyRepository rallyRepository, NoteRepository noteRepository) {
        this.pecRepository = pecRepository;
        this.rallyRepository = rallyRepository;
        this.noteRepository = noteRepository;
    }

    public List<PecDTO> getPecsByRally(String rallyId) {
        return pecRepository.findByRallyId(rallyId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public PecDTO getPecById(String id) {
        PecEntity entity = pecRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("PEC nao encontrada com ID: " + id));
        return toDTO(entity);
    }

    public PecDTO createPec(String rallyId, NewPecDTO newPecDTO) {
        RallyEntity rally = rallyRepository.findById(rallyId)
                .orElseThrow(() -> new RuntimeException("Rally nao encontrado com ID: " + rallyId));
        ensureRallyCanBeEdited(rally);

        PecEntity entity = new PecEntity();
        entity.setId(UUID.randomUUID().toString());
        entity.setRally(rally);
        entity.setNumber(newPecDTO.getNumber() != null ? newPecDTO.getNumber() : 1);
        entity.setName(newPecDTO.getName());
        entity.setDistanceKm(newPecDTO.getDistanceKm() != null ? newPecDTO.getDistanceKm() : 0.0);
        entity.setStatus(newPecDTO.getStatus() != null ? newPecDTO.getStatus() : "DRAFT");
        entity.setTotalNotes(0);
        entity.setUpdatedAt(LocalDate.now());

        return toDTO(pecRepository.save(entity));
    }

    public PecDTO patchPec(String id, PecPatchDTO patchDTO) {
        PecEntity entity = pecRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("PEC nao encontrada com ID: " + id));
        ensureRallyCanBeEdited(entity.getRally());

        if ("COMPLETED".equalsIgnoreCase(entity.getStatus()) && hasNonStatusChanges(patchDTO)) {
            throw new IllegalStateException("PEC concluida. Volte a colocar em rascunho para alterar.");
        }

        if (patchDTO.getName() != null) {
            entity.setName(patchDTO.getName());
        }
        if (patchDTO.getNumber() != null) {
            entity.setNumber(patchDTO.getNumber());
        }
        if (patchDTO.getDistanceKm() != null) {
            entity.setDistanceKm(patchDTO.getDistanceKm());
        }
        if (patchDTO.getTotalNotes() != null) {
            entity.setTotalNotes(patchDTO.getTotalNotes());
        }
        if (patchDTO.getStatus() != null) {
            entity.setStatus(patchDTO.getStatus());
        }

        entity.setUpdatedAt(LocalDate.now());
        return toDTO(pecRepository.save(entity));
    }

    private boolean hasNonStatusChanges(PecPatchDTO patchDTO) {
        return patchDTO.getNumber() != null
                || patchDTO.getName() != null
                || patchDTO.getDistanceKm() != null
                || patchDTO.getTotalNotes() != null;
    }

    public void deletePec(String id) {
        PecEntity entity = pecRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("PEC nao encontrada com ID: " + id));
        ensureRallyCanBeEdited(entity.getRally());
        if ("COMPLETED".equalsIgnoreCase(entity.getStatus())) {
            throw new IllegalStateException("PEC concluida. Volte a colocar em rascunho para eliminar.");
        }
        pecRepository.deleteById(id);
    }

    public PecOverviewDTO getPecOverview(String pecId) {
        PecEntity pec = pecRepository.findById(pecId)
                .orElseThrow(() -> new RuntimeException("PEC nao encontrada com ID: " + pecId));

        long count = noteRepository.countByPecId(pecId);

        return new PecOverviewDTO(
                pec.getId(),
                pec.getNumber(),
                pec.getName(),
                pec.getStatus(),
                pec.getDistanceKm(),
                pec.getRally() != null ? pec.getRally().getSurface() : null,
                count
        );
    }

    private PecDTO toDTO(PecEntity entity) {
        PecDTO dto = new PecDTO();
        dto.setId(entity.getId());
        dto.setNumber(entity.getNumber());
        dto.setName(entity.getName());
        dto.setDistanceKm(entity.getDistanceKm());
        dto.setTotalNotes((int) noteRepository.countByPecId(entity.getId()));
        dto.setStatus(entity.getStatus());

        if (entity.getUpdatedAt() != null) {
            dto.setUpdatedAt(entity.getUpdatedAt().toString());
        }

        if (entity.getRally() != null) {
            dto.setRallyId(entity.getRally().getId());
        }

        return dto;
    }

    private void ensureRallyCanBeEdited(RallyEntity rally) {
        if (rally != null && "COMPLETED".equalsIgnoreCase(rally.getStatus())) {
            throw new IllegalStateException("Rali concluido. Volte a colocar em rascunho para alterar PECs.");
        }
    }
}
