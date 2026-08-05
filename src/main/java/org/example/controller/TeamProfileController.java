package org.example.controller;

import org.example.dto.TeamProfileDTO;
import org.example.dto.TeamStatsDTO;
import org.example.entity.TeamCarEntity;
import org.example.service.TeamProfileService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/team-profile")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class TeamProfileController {
    private final TeamProfileService teamProfileService;

    public TeamProfileController(TeamProfileService teamProfileService) {
        this.teamProfileService = teamProfileService;
    }

    @GetMapping
    public ResponseEntity<TeamProfileDTO> getProfile() {
        return ResponseEntity.ok(teamProfileService.getProfile());
    }

    @PostMapping
    public ResponseEntity<TeamProfileDTO> createOrReplaceProfile(@RequestBody TeamProfileDTO profile) {
        return ResponseEntity.ok(teamProfileService.createOrReplaceProfile(profile));
    }

    @PatchMapping
    public ResponseEntity<TeamProfileDTO> updateProfile(@RequestBody TeamProfileDTO profile) {
        return ResponseEntity.ok(teamProfileService.updateProfile(profile));
    }

    @GetMapping("/stats")
    public ResponseEntity<TeamStatsDTO> getStats() {
        return ResponseEntity.ok(teamProfileService.getStats());
    }

    @GetMapping("/cars")
    public ResponseEntity<List<TeamCarEntity>> getCars() {
        return ResponseEntity.ok(teamProfileService.getCars());
    }

    @PostMapping("/cars")
    public ResponseEntity<TeamCarEntity> createCar(@RequestBody TeamCarEntity car) {
        return ResponseEntity.ok(teamProfileService.createCar(car));
    }

    @PatchMapping("/cars/{carId}")
    public ResponseEntity<TeamCarEntity> updateCar(@PathVariable String carId, @RequestBody TeamCarEntity car) {
        return ResponseEntity.ok(teamProfileService.updateCar(carId, car));
    }

    @PostMapping("/cars/{carId}/select")
    public ResponseEntity<TeamProfileDTO> selectCar(@PathVariable String carId) {
        return ResponseEntity.ok(teamProfileService.selectCar(carId));
    }

    @DeleteMapping("/cars/{carId}")
    public ResponseEntity<Void> deleteCar(@PathVariable String carId) {
        teamProfileService.deleteCar(carId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/cars/{carId}/photo")
    public ResponseEntity<TeamCarEntity> uploadCarPhoto(
            @PathVariable String carId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(teamProfileService.uploadCarPhoto(carId, file));
    }

    @GetMapping("/cars/{carId}/photo")
    public ResponseEntity<Resource> getCarPhoto(@PathVariable String carId) {
        Resource resource = teamProfileService.getCarPhotoResource(carId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(teamProfileService.getCarPhotoContentType(carId)))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(resource);
    }

    @PostMapping("/logo")
    public ResponseEntity<TeamProfileDTO> uploadLogo(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(teamProfileService.uploadLogo(file));
    }

    @GetMapping("/logo")
    public ResponseEntity<Resource> getLogo() {
        Resource resource = teamProfileService.getLogoResource();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(teamProfileService.getLogoContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(resource);
    }
}
