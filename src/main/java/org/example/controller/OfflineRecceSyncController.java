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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.CacheControl;

@RestController
@RequestMapping("/api/offline-recces")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class OfflineRecceSyncController {
    public static final String EXPLICIT_CREW = "recce.offline.explicitCrew";
    private final OfflineRecceSyncService offlineRecceSyncService;

    public OfflineRecceSyncController(OfflineRecceSyncService offlineRecceSyncService) {
        this.offlineRecceSyncService = offlineRecceSyncService;
    }

    @PostMapping("/sync")
    public ResponseEntity<OfflineRecceSyncResponseDTO> sync(@RequestBody OfflineRecceSyncRequestDTO request,
            @RequestAttribute(name = EXPLICIT_CREW, required = false) Boolean explicitCrew) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(offlineRecceSyncService.sync(request, Boolean.TRUE.equals(explicitCrew)));
    }

    @PostMapping("/sync/{receiptId}/audio")
    public ResponseEntity<Void> audio(@PathVariable String receiptId, @RequestParam String accountId,
                                      @RequestParam String crewId, @RequestParam MultipartFile file) {
        offlineRecceSyncService.uploadAudio(receiptId, accountId, crewId, file);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
