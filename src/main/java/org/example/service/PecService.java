package org.example.service;

import org.example.dto.NewPecDTO;
import org.example.dto.PecDTO;
import org.example.dto.PecPatchDTO;
import org.example.entity.PecEntity;
import org.example.entity.RallyEntity;
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

    public PecService(PecRepository pecRepository, RallyRepository rallyRepository) {
        this.pecRepository = pecRepository;
        this.rallyRepository = rallyRepository;
    }

    public List<PecDTO> getPecsByRally(String rallyId) {
        return pecRepository.findByRallyId(rallyId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public PecDTO getPecById(String id) {
        PecEntity entity = pecRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("PEC não encontrada com ID: " + id));
        return toDTO(entity);
    }

    public PecDTO createPec(String rallyId, NewPecDTO newPecDTO) {
        // 1. Procurar o Rally na base de dados (se não existir, lança erro antes de guardar a PEC)
        RallyEntity rally = rallyRepository.findById(rallyId)
                .orElseThrow(() -> new RuntimeException("Rally não encontrado com ID: " + rallyId));

        PecEntity entity = new PecEntity();

        // 2. Gerar o ID UUID no Backend
        entity.setId(UUID.randomUUID().toString());

        // 3. Associar a entidade Rally e mapear dados do DTO
        entity.setId(UUID.randomUUID().toString());
        entity.setRally(rally); // CORRIGIDO: Passa a entidade RallyEntity
        entity.setNumber(newPecDTO.getNumber() != null ? newPecDTO.getNumber() : 1);
        entity.setName(newPecDTO.getName());
        entity.setDistanceKm(newPecDTO.getDistanceKm() != null ? newPecDTO.getDistanceKm() : 0.0);
        entity.setStatus(newPecDTO.getStatus());

        // 4. Valores por defeito para nova PEC
        entity.setTotalNotes(0);
        entity.setUpdatedAt(LocalDate.now()); // CORRIGIDO: Tipo LocalDate correto (sem .toString())

        // 5. Guardar na BD
        PecEntity savedEntity = pecRepository.save(entity);

        // 6. Converter para DTO de resposta
        return toDTO(savedEntity);
    }

    public PecDTO patchPec(String id, PecPatchDTO patchDTO) {
        PecEntity entity = pecRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("PEC não encontrada com ID: " + id));

        if (patchDTO.getName() != null) {
            entity.setName(patchDTO.getName());
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

        PecEntity updated = pecRepository.save(entity);
        return toDTO(updated);
    }

    public void deletePec(String id) {
        if (!pecRepository.existsById(id)) {
            throw new RuntimeException("PEC não encontrada com ID: " + id);
        }
        pecRepository.deleteById(id);
    }

    // Método único para conversão de Entidade para DTO
    private PecDTO toDTO(PecEntity entity) {
        PecDTO dto = new PecDTO();
        dto.setId(entity.getId());
        dto.setNumber(entity.getNumber());
        dto.setName(entity.getName());
        dto.setDistanceKm(entity.getDistanceKm());
        dto.setTotalNotes(entity.getTotalNotes());
        dto.setStatus(entity.getStatus());

        if (entity.getUpdatedAt() != null) {
            dto.setUpdatedAt(entity.getUpdatedAt().toString());
        }

        if (entity.getRally() != null) {
            dto.setRallyId(entity.getRally().getId());
        }

        return dto;
    }
}