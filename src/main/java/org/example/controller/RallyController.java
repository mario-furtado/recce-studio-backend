package org.example.controller;

import org.example.entity.RallyEntity;
import org.example.repository.RallyRepository;
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

    // 1. GET ALL
    @GetMapping
    public ResponseEntity<List<RallyEntity>> getAllRallies() {
        return ResponseEntity.ok(rallyRepository.findAllByOrderByYearDescNameAsc());
    }

    // 2. GET BY ID
    @GetMapping("/{id}")
    public ResponseEntity<RallyEntity> getRallyById(@PathVariable String id) {
        return rallyRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 3. POST (Criar Rali)
    @PostMapping
    public ResponseEntity<RallyEntity> createRally(@RequestBody RallyEntity rally) {
        RallyEntity savedRally = rallyRepository.save(rally);
        return ResponseEntity.ok(savedRally);
    }

    // 4. PUT / PATCH (Atualizar Rali existente)
    @PutMapping("/{id}")
    public ResponseEntity<RallyEntity> updateRally(
            @PathVariable String id,
            @RequestBody RallyEntity updatedData) {

        return rallyRepository.findById(id).map(existingRally -> {
            existingRally.setName(updatedData.getName());
            existingRally.setYear(updatedData.getYear());
            existingRally.setSurface(updatedData.getSurface());
            existingRally.setLocation(updatedData.getLocation());
            existingRally.setIcon(updatedData.getIcon());

            RallyEntity saved = rallyRepository.save(existingRally);
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    // 5. DELETE
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRally(@PathVariable String id) {
        if (rallyRepository.existsById(id)) {
            rallyRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}