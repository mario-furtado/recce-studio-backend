package org.example.controller;

import org.example.entity.RallyEntity;
import org.example.repository.PecRepository;
import org.example.repository.RallyRepository;
import org.example.service.TeamProfileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rallies")
@CrossOrigin(origins = "http://localhost:4200") // Permite chamadas do Angular
public class RallyController {

    @Autowired
    private RallyRepository rallyRepository;

    @Autowired
    private PecRepository pecRepository;

    @Autowired
    private TeamProfileService teamProfileService;

    // 1. GET ALL
    @GetMapping
    public ResponseEntity<List<RallyEntity>> getAllRallies() {
        List<RallyEntity> rallies = rallyRepository.findAllByOrderByYearDescNameAsc();
        rallies.forEach(this::attachPecsCount);
        return ResponseEntity.ok(rallies);
    }

    // 2. GET BY ID
    @GetMapping("/{id}")
    public ResponseEntity<RallyEntity> getRallyById(@PathVariable String id) {
        return rallyRepository.findById(id)
                .map(this::attachPecsCount)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 3. POST (Criar Rali)
    @PostMapping
    public ResponseEntity<RallyEntity> createRally(@RequestBody RallyEntity rally) {
        if (rally.getStatus() == null || rally.getStatus().trim().isEmpty()) {
            rally.setStatus("DRAFT");
        }
        RallyEntity savedRally = rallyRepository.save(rally);
        syncSelectedCar(savedRally);
        attachPecsCount(savedRally);
        return ResponseEntity.ok(savedRally);
    }

    // 4. PUT / PATCH (Atualizar Rali existente)
    @PutMapping("/{id}")
    public ResponseEntity<RallyEntity> updateRally(
            @PathVariable String id,
            @RequestBody RallyEntity updatedData) {

        return rallyRepository.findById(id).map(existingRally -> {
            if ("COMPLETED".equalsIgnoreCase(existingRally.getStatus()) && hasNonStatusChanges(updatedData)) {
                throw new IllegalStateException("Rali concluido. Volte a colocar em rascunho para alterar.");
            }
            if (updatedData.getName() != null) existingRally.setName(updatedData.getName());
            if (updatedData.getYear() != 0) existingRally.setYear(updatedData.getYear());
            if (updatedData.getSurface() != null) existingRally.setSurface(updatedData.getSurface());
            if (updatedData.getLocation() != null) existingRally.setLocation(updatedData.getLocation());
            if (updatedData.getIcon() != null) existingRally.setIcon(updatedData.getIcon());
            if (updatedData.getCarId() != null) existingRally.setCarId(updatedData.getCarId());
            if (updatedData.getCarClass() != null) existingRally.setCarClass(updatedData.getCarClass());
            if (updatedData.getStatus() != null) {
                existingRally.setStatus(updatedData.getStatus());
            }

            RallyEntity saved = rallyRepository.save(existingRally);
            syncSelectedCar(saved);
            attachPecsCount(saved);
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    private RallyEntity attachPecsCount(RallyEntity rally) {
        rally.setPecsCount(pecRepository.countByRallyId(rally.getId()));
        return rally;
    }

    private void syncSelectedCar(RallyEntity rally) {
        if (rally.getCarId() != null && !rally.getCarId().trim().isEmpty()) {
            teamProfileService.selectCar(rally.getCarId());
        }
    }

    private boolean hasNonStatusChanges(RallyEntity updatedData) {
        return updatedData.getName() != null
                || updatedData.getYear() != 0
                || updatedData.getSurface() != null
                || updatedData.getLocation() != null
                || updatedData.getIcon() != null
                || updatedData.getCarId() != null
                || updatedData.getCarClass() != null;
    }

    // 5. DELETE
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRally(@PathVariable String id) {
        return rallyRepository.findById(id).map(rally -> {
            if ("COMPLETED".equalsIgnoreCase(rally.getStatus())) {
                throw new IllegalStateException("Rali concluido. Volte a colocar em rascunho para eliminar.");
            }
            rallyRepository.deleteById(id);
            return ResponseEntity.noContent().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
