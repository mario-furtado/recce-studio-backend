package org.example.controller;

import org.example.dto.ClickMarkerDto;
import org.example.dto.GpsPointDTO;
import org.example.dto.PecAssetDTO;
import org.example.service.PecAssetService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/pecs")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class PecAssetController {
    private final PecAssetService pecAssetService;

    public PecAssetController(PecAssetService pecAssetService) {
        this.pecAssetService = pecAssetService;
    }

    @GetMapping("/{pecId}/assets")
    public ResponseEntity<PecAssetDTO> getAssets(@PathVariable String pecId) {
        return ResponseEntity.ok(pecAssetService.getAssets(pecId));
    }

    @PostMapping("/{pecId}/video")
    public ResponseEntity<PecAssetDTO> uploadVideo(@PathVariable String pecId, @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(pecAssetService.saveVideo(pecId, file));
    }

    @DeleteMapping("/{pecId}/video")
    public ResponseEntity<PecAssetDTO> deleteVideo(@PathVariable String pecId) {
        return ResponseEntity.ok(pecAssetService.deleteVideo(pecId));
    }

    @GetMapping("/{pecId}/video")
    public ResponseEntity<Resource> getVideo(@PathVariable String pecId) {
        Resource resource = pecAssetService.getVideoResource(pecId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(pecAssetService.getVideoContentType(pecId)))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(resource);
    }

    @PostMapping("/{pecId}/audio")
    public ResponseEntity<PecAssetDTO> uploadAudio(@PathVariable String pecId, @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(pecAssetService.saveAudio(pecId, file));
    }

    @DeleteMapping("/{pecId}/audio")
    public ResponseEntity<PecAssetDTO> deleteAudio(@PathVariable String pecId) {
        return ResponseEntity.ok(pecAssetService.deleteAudio(pecId));
    }

    @GetMapping("/{pecId}/audio")
    public ResponseEntity<byte[]> getAudio(@PathVariable String pecId) {
        byte[] audio = pecAssetService.getAudioBytes(pecId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(pecAssetService.getAudioContentType(pecId)))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .contentLength(audio.length)
                .body(audio);
    }

    @PostMapping("/{pecId}/gps")
    public ResponseEntity<PecAssetDTO> uploadGps(@PathVariable String pecId, @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(pecAssetService.saveGps(pecId, file));
    }

    @GetMapping("/{pecId}/gps/track")
    public ResponseEntity<List<GpsPointDTO>> getGpsTrack(@PathVariable String pecId) {
        return ResponseEntity.ok(pecAssetService.getGpsTrack(pecId));
    }

    @GetMapping("/{pecId}/gps/markers")
    public ResponseEntity<List<ClickMarkerDto>> getRecceMarkers(@PathVariable String pecId) {
        return ResponseEntity.ok(pecAssetService.getRecceMarkers(pecId));
    }
}
