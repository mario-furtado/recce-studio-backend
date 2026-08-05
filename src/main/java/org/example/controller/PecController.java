package org.example.controller;

import org.example.dto.NewPecDTO;
import org.example.dto.PecDTO;
import org.example.dto.PecOverviewDTO;
import org.example.dto.PecPatchDTO;
import org.example.service.PecService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class PecController {

    private final PecService pecService;

    public PecController(PecService pecService) {
        this.pecService = pecService;
    }

    // GET: Listar todas as PECs de um Rally específico
    @GetMapping("/rallies/{rallyId}/pecs")
    public ResponseEntity<List<PecDTO>> getPecsByRally(@PathVariable String rallyId) {
        return ResponseEntity.ok(pecService.getPecsByRally(rallyId));
    }

    @GetMapping("/pecs/{id}")
    public ResponseEntity<PecOverviewDTO> getPecById(@PathVariable String id) {
        return ResponseEntity.ok(pecService.getPecOverview(id));
    }

    // POST: Criar uma nova PEC para um Rally
    @PostMapping("/rallies/{rallyId}/pecs")
    public ResponseEntity<PecDTO> createPec(@PathVariable String rallyId, @RequestBody NewPecDTO dto) {
        PecDTO created = pecService.createPec(rallyId, dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // PATCH: Atualizar parcialmente os dados de uma PEC
    @PatchMapping("/pecs/{id}")
    public ResponseEntity<PecDTO> patchPec(@PathVariable String id, @RequestBody PecPatchDTO patchDTO) {
        return ResponseEntity.ok(pecService.patchPec(id, patchDTO));
    }

    // DELETE: Eliminar uma PEC
    @DeleteMapping("/pecs/{id}")
    public ResponseEntity<Void> deletePec(@PathVariable String id) {
        pecService.deletePec(id);
        return ResponseEntity.noContent().build();
    }

}
