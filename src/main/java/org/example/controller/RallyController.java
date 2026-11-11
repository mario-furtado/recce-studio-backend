package org.example.controller;

import org.example.entity.RallyEntity;
import org.example.repository.PecRepository;
import org.example.repository.RallyRepository;
import org.example.service.FileStorageService;
import org.example.service.TeamProfileService;
import org.example.service.CrewService;
import org.example.service.RallyWriteGuard;
import org.example.service.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.time.Clock;

@RestController
@RequestMapping("/api/rallies")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class RallyController {

    @Autowired
    private RallyRepository rallyRepository;

    @Autowired
    private PecRepository pecRepository;

    @Autowired
    private TeamProfileService teamProfileService;

    @Autowired
    private FileStorageService fileStorageService;

    @Autowired
    private TenantContext tenantContext;

    @Autowired private CrewService crews;
    @Autowired private RallyWriteGuard writes;
    @Autowired private Clock clock;

    // 1. GET ALL
    @GetMapping
    public ResponseEntity<List<RallyEntity>> getAllRallies() {
        List<RallyEntity> rallies = rallyRepository.findAllByTeamProfileIdOrderByYearDescNameAsc(
                tenantContext.requireTeamProfileId());
        rallies.forEach(this::attachPecsCount);
        return ResponseEntity.ok(rallies);
    }

    // 2. GET BY ID
    @GetMapping("/{id}")
    public ResponseEntity<RallyEntity> getRallyById(@PathVariable String id) {
        return rallyRepository.findByIdAndTeamProfileId(id, tenantContext.requireTeamProfileId())
                .map(this::attachPecsCount)
                .map(this::attachArchiveCapability)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 3. POST (Criar Rali)
    @PostMapping
    public ResponseEntity<RallyEntity> createRally(@RequestBody RallyEntity rally) {
        String teamProfileId = tenantContext.requireTeamProfileId();
        rally.setId(null);
        if (rally.getStatus() == null || rally.getStatus().trim().isEmpty()) {
            rally.setStatus("DRAFT");
        }
        rally.setTeamProfileId(teamProfileId);
        syncSelectedCar(rally);
        RallyEntity savedRally = rallyRepository.save(rally);
        attachPecsCount(savedRally);
        return ResponseEntity.ok(savedRally);
    }

    // 4. PUT / PATCH (Atualizar Rali existente)
    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<RallyEntity> updateRally(
            @PathVariable String id,
            @RequestBody RallyEntity updatedData) {

        return rallyRepository.findByIdAndTeamProfileId(id, tenantContext.requireTeamProfileId()).map(existingRally -> {
            writes.requireWritable(existingRally);
            if ("COMPLETED".equalsIgnoreCase(existingRally.getStatus()) && hasNonStatusChanges(updatedData)) {
                throw new IllegalStateException("Rali concluido. Volte a colocar em rascunho para alterar.");
            }
            if (updatedData.getName() != null) existingRally.setName(updatedData.getName());
            if (updatedData.getYear() != 0) existingRally.setYear(updatedData.getYear());
            if (updatedData.getSurface() != null) existingRally.setSurface(updatedData.getSurface());
            if (updatedData.getLocation() != null) existingRally.setLocation(updatedData.getLocation());
            if (updatedData.getIcon() != null) existingRally.setIcon(updatedData.getIcon());
            if (updatedData.getLogoFileName() != null) existingRally.setLogoFileName(updatedData.getLogoFileName());
            if (updatedData.getLogoContentType() != null) existingRally.setLogoContentType(updatedData.getLogoContentType());
            if (updatedData.getLogoStoragePath() != null) existingRally.setLogoStoragePath(updatedData.getLogoStoragePath());
            if (updatedData.getCarId() != null) existingRally.setCarId(updatedData.getCarId());
            if (updatedData.getCarClass() != null) existingRally.setCarClass(updatedData.getCarClass());
            if (updatedData.getStatus() != null) {
                existingRally.setStatus(updatedData.getStatus());
            }

            syncSelectedCar(existingRally);
            RallyEntity saved = rallyRepository.save(existingRally);
            attachPecsCount(saved);
            return ResponseEntity.ok(attachArchiveCapability(saved));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<RallyEntity> archive(@PathVariable String id) {
        return setArchive(id, true);
    }

    @DeleteMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<RallyEntity> restore(@PathVariable String id) {
        return setArchive(id, false);
    }

    private ResponseEntity<RallyEntity> setArchive(String id, boolean archive) {
        String team = tenantContext.requireTeamProfileId();
        RallyEntity rally = rallyRepository.findByIdAndTeamProfileId(id, team)
                .orElseThrow(() -> new ResourceNotFoundException("Rali indisponível."));
        crews.requireOwned(tenantContext.requireAccountId(), team);
        writes.lock(rally);
        if (!archive) rally.setArchivedAt(null);
        else if (rally.getArchivedAt() == null) rally.setArchivedAt(clock.millis());
        rally.setArchiveManageable(true);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(attachPecsCount(rally));
    }

    private RallyEntity attachArchiveCapability(RallyEntity rally) {
        if (crews.enabled()) {
            try {
                crews.requireOwned(tenantContext.requireAccountId(), rally.getTeamProfileId());
                rally.setArchiveManageable(true);
            } catch (ResourceNotFoundException ignored) {
                // Unmigrated teams retain their previous rally capabilities.
            }
        }
        return rally;
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
                || updatedData.getLogoFileName() != null
                || updatedData.getLogoContentType() != null
                || updatedData.getLogoStoragePath() != null
                || updatedData.getCarId() != null
                || updatedData.getCarClass() != null;
    }

    private boolean isBrowserSupportedImage(String contentType) {
        return "image/jpeg".equalsIgnoreCase(contentType)
                || "image/png".equalsIgnoreCase(contentType)
                || "image/webp".equalsIgnoreCase(contentType)
                || "image/gif".equalsIgnoreCase(contentType);
    }

    @PostMapping("/{id}/logo")
    @Transactional
    public ResponseEntity<RallyEntity> uploadLogo(@PathVariable String id, @RequestParam("file") MultipartFile file) {
        return rallyRepository.findByIdAndTeamProfileId(id, tenantContext.requireTeamProfileId()).map(rally -> {
            writes.requireWritable(rally);
            if ("COMPLETED".equalsIgnoreCase(rally.getStatus())) {
                throw new IllegalStateException("Rali concluido. Volte a colocar em rascunho para alterar.");
            }
            if (file == null || file.isEmpty()) {
                throw new IllegalArgumentException("Imagem obrigatoria.");
            }
            if (!isBrowserSupportedImage(file.getContentType())) {
                throw new IllegalArgumentException("A imagem deve estar em JPG, PNG, WebP ou GIF.");
            }

            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "logo";
            String storageKey = fileStorageService.store(file, "rallies/" + id, "logo");
            fileStorageService.delete(rally.getLogoStoragePath());

            rally.setLogoFileName(originalName);
            rally.setLogoContentType(file.getContentType());
            rally.setLogoStoragePath(storageKey);
            RallyEntity saved = rallyRepository.save(rally);
            attachPecsCount(saved);
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/logo")
    public ResponseEntity<byte[]> getLogo(@PathVariable String id) {
        return rallyRepository.findByIdAndTeamProfileId(id, tenantContext.requireTeamProfileId()).map(rally -> {
            if (rally.getLogoStoragePath() == null) {
                return ResponseEntity.notFound().<byte[]>build();
            }
            byte[] image = fileStorageService.loadBytes(rally.getLogoStoragePath());
            String contentType = rally.getLogoContentType() != null ? rally.getLogoContentType() : "application/octet-stream";
            return ResponseEntity.<byte[]>ok()
                    .cacheControl(CacheControl.noStore())
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                    .contentLength(image.length)
                    .body(image);
        }).orElse(ResponseEntity.notFound().build());
    }

    // 5. DELETE
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteRally(@PathVariable String id) {
        return rallyRepository.findByIdAndTeamProfileId(id, tenantContext.requireTeamProfileId()).map(rally -> {
            writes.requireWritable(rally);
            if ("COMPLETED".equalsIgnoreCase(rally.getStatus())) {
                throw new IllegalStateException("Rali concluido. Volte a colocar em rascunho para eliminar.");
            }
            fileStorageService.delete(rally.getLogoStoragePath());
            rallyRepository.deleteById(id);
            return ResponseEntity.noContent().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
