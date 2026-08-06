package org.example.controller;

import org.example.dto.OfflineRecceSyncRequestDTO;
import org.example.dto.OfflineRecceSyncResponseDTO;
import org.example.service.OfflineRecceSyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/offline-recces")
@CrossOrigin(origins = "http://localhost:4200")
public class OfflineRecceSyncController {
    private final OfflineRecceSyncService offlineRecceSyncService;

    public OfflineRecceSyncController(OfflineRecceSyncService offlineRecceSyncService) {
        this.offlineRecceSyncService = offlineRecceSyncService;
    }

    @PostMapping("/sync")
    public ResponseEntity<OfflineRecceSyncResponseDTO> sync(@RequestBody OfflineRecceSyncRequestDTO request) {
        return ResponseEntity.ok(offlineRecceSyncService.sync(request));
    }
}
