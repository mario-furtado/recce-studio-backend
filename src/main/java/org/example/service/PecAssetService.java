package org.example.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.dto.ClickMarkerDto;
import org.example.dto.GpsPointDTO;
import org.example.dto.PecAssetDTO;
import org.example.entity.OfflineRecceSyncEntity;
import org.example.entity.PecEntity;
import org.example.repository.OfflineRecceSyncRepository;
import org.example.repository.PecRepository;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@Service
public class PecAssetService {
    private final PecRepository pecRepository;
    private final OfflineRecceSyncRepository offlineRecceSyncRepository;
    private final ObjectMapper objectMapper;
    private final FileStorageService fileStorageService;

    public PecAssetService(
            PecRepository pecRepository,
            OfflineRecceSyncRepository offlineRecceSyncRepository,
            ObjectMapper objectMapper,
            FileStorageService fileStorageService) {
        this.pecRepository = pecRepository;
        this.offlineRecceSyncRepository = offlineRecceSyncRepository;
        this.objectMapper = objectMapper;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public PecAssetDTO saveVideo(String pecId, MultipartFile file) {
        PecEntity pec = getPec(pecId);
        ensureCanEdit(pec);
        String path = fileStorageService.store(file, "pecs/" + pecId, "video");
        fileStorageService.delete(pec.getVideoStoragePath());
        pec.setVideoFileName(file.getOriginalFilename());
        pec.setVideoContentType(file.getContentType());
        pec.setVideoStoragePath(path);
        pec.setUpdatedAt(LocalDate.now());
        return toAssetDTO(pecRepository.save(pec));
    }

    @Transactional
    public PecAssetDTO deleteVideo(String pecId) {
        PecEntity pec = getPec(pecId);
        ensureCanEdit(pec);
        fileStorageService.delete(pec.getVideoStoragePath());
        pec.setVideoFileName(null);
        pec.setVideoContentType(null);
        pec.setVideoStoragePath(null);
        pec.setUpdatedAt(LocalDate.now());
        return toAssetDTO(pecRepository.save(pec));
    }

    @Transactional
    public PecAssetDTO saveAudio(String pecId, MultipartFile file) {
        PecEntity pec = getPec(pecId);
        ensureCanEdit(pec);
        validateAudio(file);
        String path = fileStorageService.store(file, "pecs/" + pecId, "audio");
        fileStorageService.delete(pec.getAudioStoragePath());
        pec.setAudioFileName(file.getOriginalFilename());
        pec.setAudioContentType(normalizeAudioContentType(file.getContentType(), file.getOriginalFilename()));
        pec.setAudioStoragePath(path);
        pec.setUpdatedAt(LocalDate.now());
        return toAssetDTO(pecRepository.save(pec));
    }

    @Transactional
    public PecAssetDTO deleteAudio(String pecId) {
        PecEntity pec = getPec(pecId);
        ensureCanEdit(pec);
        fileStorageService.delete(pec.getAudioStoragePath());
        pec.setAudioFileName(null);
        pec.setAudioContentType(null);
        pec.setAudioStoragePath(null);
        pec.setUpdatedAt(LocalDate.now());
        return toAssetDTO(pecRepository.save(pec));
    }

    @Transactional
    public PecAssetDTO saveGps(String pecId, MultipartFile file) {
        PecEntity pec = getPec(pecId);
        ensureCanEdit(pec);
        String path = fileStorageService.store(file, "pecs/" + pecId, "gps");
        fileStorageService.delete(pec.getGpsStoragePath());
        pec.setGpsFileName(file.getOriginalFilename());
        pec.setGpsContentType(file.getContentType());
        pec.setGpsStoragePath(path);
        pec.setUpdatedAt(LocalDate.now());
        return toAssetDTO(pecRepository.save(pec));
    }

    @Transactional(readOnly = true)
    public PecAssetDTO getAssets(String pecId) {
        return toAssetDTO(getPec(pecId));
    }

    @Transactional(readOnly = true)
    public Resource getVideoResource(String pecId) {
        PecEntity pec = getPec(pecId);
        if (pec.getVideoStoragePath() == null) {
            throw new RuntimeException("Video nao encontrado para a PEC: " + pecId);
        }
        return fileStorageService.loadAsResource(pec.getVideoStoragePath());
    }

    @Transactional(readOnly = true)
    public String getVideoContentType(String pecId) {
        PecEntity pec = getPec(pecId);
        return pec.getVideoContentType() != null ? pec.getVideoContentType() : "application/octet-stream";
    }

    @Transactional(readOnly = true)
    public Resource getAudioResource(String pecId) {
        PecEntity pec = getPec(pecId);
        if (pec.getAudioStoragePath() == null) {
            throw new RuntimeException("Audio nao encontrado para a PEC: " + pecId);
        }
        return fileStorageService.loadAsResource(pec.getAudioStoragePath());
    }

    @Transactional(readOnly = true)
    public byte[] getAudioBytes(String pecId) {
        PecEntity pec = getPec(pecId);
        if (pec.getAudioStoragePath() == null) {
            throw new RuntimeException("Audio nao encontrado para a PEC: " + pecId);
        }
        return fileStorageService.loadBytes(pec.getAudioStoragePath());
    }

    @Transactional(readOnly = true)
    public String getAudioContentType(String pecId) {
        PecEntity pec = getPec(pecId);
        return pec.getAudioContentType() != null ? pec.getAudioContentType() : "application/octet-stream";
    }

    @Transactional(readOnly = true)
    public List<GpsPointDTO> getGpsTrack(String pecId) {
        PecEntity pec = getPec(pecId);
        if (pec.getGpsStoragePath() == null) {
            return getOfflineGpsTrack(pecId);
        }

        try {
            String lowerName = fileStorageService.fileName(pec.getGpsStoragePath()).toLowerCase();
            if (lowerName.endsWith(".gpx") || "application/gpx+xml".equals(pec.getGpsContentType())) {
                try (InputStream inputStream = fileStorageService.open(pec.getGpsStoragePath())) {
                    return parseGpx(inputStream);
                }
            }
            try (InputStream inputStream = fileStorageService.open(pec.getGpsStoragePath())) {
                return parseJson(inputStream);
            }
        } catch (Exception e) {
            throw new RuntimeException("Erro ao ler GPS da PEC: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<ClickMarkerDto> getRecceMarkers(String pecId) {
        getPec(pecId);
        for (OfflineRecceSyncEntity sync : offlineRecceSyncRepository.findByPecIdOrderBySyncedAtDesc(pecId)) {
            List<ClickMarkerDto> markers = safeParseMarkerJson(sync.getMarkersJson());
            if (!markers.isEmpty()) {
                return markers;
            }
        }
        return new ArrayList<>();
    }

    private PecEntity getPec(String pecId) {
        return pecRepository.findById(pecId)
                .orElseThrow(() -> new RuntimeException("PEC nao encontrada com ID: " + pecId));
    }

    private void ensureCanEdit(PecEntity pec) {
        if ("COMPLETED".equalsIgnoreCase(pec.getStatus())
                || (pec.getRally() != null && "COMPLETED".equalsIgnoreCase(pec.getRally().getStatus()))) {
            throw new IllegalStateException("PEC ou rali concluido. Volte a colocar em rascunho para alterar.");
        }
    }

    private PecAssetDTO toAssetDTO(PecEntity pec) {
        boolean hasSyncedGps = hasSyncedGps(pec.getId());
        PecAssetDTO dto = new PecAssetDTO();
        dto.setHasVideo(pec.getVideoStoragePath() != null);
        dto.setVideoFileName(pec.getVideoFileName());
        dto.setVideoUrl(pec.getVideoStoragePath() != null ? "/api/pecs/" + pec.getId() + "/video" : null);
        dto.setHasAudio(pec.getAudioStoragePath() != null);
        dto.setAudioFileName(pec.getAudioFileName());
        dto.setAudioUrl(pec.getAudioStoragePath() != null ? "/api/pecs/" + pec.getId() + "/audio" : null);
        dto.setHasGps(pec.getGpsStoragePath() != null || hasSyncedGps);
        dto.setGpsFileName(pec.getGpsFileName() != null ? pec.getGpsFileName() : (hasSyncedGps ? "Reconhecimento sincronizado" : null));
        dto.setGpsUrl(pec.getGpsStoragePath() != null || hasSyncedGps ? "/api/pecs/" + pec.getId() + "/gps/track" : null);
        return dto;
    }

    private void validateAudio(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("Ficheiro audio vazio");
        }
        String contentType = file.getContentType();
        String lowerContentType = contentType != null ? contentType.toLowerCase() : "";
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        boolean validContentType = lowerContentType.isEmpty()
                || lowerContentType.startsWith("audio/")
                || lowerContentType.startsWith("video/webm")
                || lowerContentType.startsWith("video/mp4")
                || "application/octet-stream".equals(lowerContentType);
        boolean validExtension = fileName.endsWith(".webm")
                || fileName.endsWith(".m4a")
                || fileName.endsWith(".mp4")
                || fileName.endsWith(".mp3")
                || fileName.endsWith(".ogg")
                || fileName.endsWith(".wav")
                || fileName.endsWith(".aac");
        if (!validContentType && !validExtension) {
            throw new RuntimeException("O ficheiro deve ser audio.");
        }
    }

    private String normalizeAudioContentType(String contentType, String originalFilename) {
        String lowerContentType = contentType != null ? contentType.toLowerCase() : "";
        String fileName = originalFilename != null ? originalFilename.toLowerCase() : "";
        if (lowerContentType.contains("mp4") || lowerContentType.contains("aac") || fileName.endsWith(".m4a") || fileName.endsWith(".mp4")) {
            return "audio/mp4";
        }
        if (lowerContentType.contains("mpeg") || lowerContentType.contains("mp3") || fileName.endsWith(".mp3")) {
            return "audio/mpeg";
        }
        if (lowerContentType.contains("ogg") || fileName.endsWith(".ogg")) {
            return "audio/ogg";
        }
        if (lowerContentType.contains("wav") || fileName.endsWith(".wav")) {
            return "audio/wav";
        }
        if (lowerContentType.startsWith("audio/")) {
            return lowerContentType;
        }
        return "audio/webm";
    }

    private List<GpsPointDTO> parseGpx(InputStream inputStream) throws Exception {
        List<GpsPointDTO> points = new ArrayList<>();
        Document document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(inputStream);
        NodeList nodes = document.getElementsByTagName("trkpt");
        for (int i = 0; i < nodes.getLength(); i++) {
            org.w3c.dom.Node node = nodes.item(i);
            double lat = Double.parseDouble(node.getAttributes().getNamedItem("lat").getNodeValue());
            double lng = Double.parseDouble(node.getAttributes().getNamedItem("lon").getNodeValue());
            points.add(new GpsPointDTO(lat, lng, null, (double) i));
        }
        return points;
    }

    private List<GpsPointDTO> parseJson(InputStream inputStream) throws Exception {
        JsonNode root = objectMapper.readTree(inputStream);
        JsonNode array = root.isArray() ? root : firstArray(root);
        List<GpsPointDTO> points = new ArrayList<>();
        if (array == null) {
            return points;
        }
        for (JsonNode item : array) {
            Double lat = number(item, "lat", "latitude");
            Double lng = number(item, "lng", "lon", "longitude");
            Double speed = number(item, "speedKmh", "speed_kmh", "speed");
            Double timestamp = number(item, "timestamp", "time", "t");
            Double accuracy = number(item, "accuracy", "accuracyM", "accuracy_m");
            if (lat != null && lng != null) {
                GpsPointDTO point = new GpsPointDTO(lat, lng, speed, timestamp);
                point.setAccuracy(accuracy);
                points.add(point);
            }
        }
        return points;
    }

    private List<GpsPointDTO> getOfflineGpsTrack(String pecId) {
        for (OfflineRecceSyncEntity sync : offlineRecceSyncRepository.findByPecIdOrderBySyncedAtDesc(pecId)) {
            List<GpsPointDTO> track = safeParseGpsTrackJson(sync.getGpsTrackJson());
            if (!track.isEmpty()) {
                return track;
            }
        }
        return new ArrayList<>();
    }

    private boolean hasSyncedGps(String pecId) {
        for (OfflineRecceSyncEntity sync : offlineRecceSyncRepository.findByPecIdOrderBySyncedAtDesc(pecId)) {
            if (!safeParseGpsTrackJson(sync.getGpsTrackJson()).isEmpty()) {
                return true;
            }
            List<ClickMarkerDto> markers = safeParseMarkerJson(sync.getMarkersJson());
            for (ClickMarkerDto marker : markers) {
                if (marker.getLatitude() != null && marker.getLongitude() != null) {
                    return true;
                }
            }
        }
        return false;
    }

    private List<GpsPointDTO> safeParseGpsTrackJson(String json) {
        try {
            return parseGpsTrackJson(json);
        } catch (RuntimeException ignored) {
            return new ArrayList<>();
        }
    }

    private List<ClickMarkerDto> safeParseMarkerJson(String json) {
        try {
            return parseMarkerJson(json);
        } catch (RuntimeException ignored) {
            return new ArrayList<>();
        }
    }

    private List<GpsPointDTO> parseGpsTrackJson(String json) {
        if (json == null || json.trim().isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<GpsPointDTO>>() {});
        } catch (Exception e) {
            throw new RuntimeException("Erro ao ler track GPS sincronizado: " + e.getMessage());
        }
    }

    private List<ClickMarkerDto> parseMarkerJson(String json) {
        if (json == null || json.trim().isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<ClickMarkerDto>>() {});
        } catch (Exception e) {
            throw new RuntimeException("Erro ao ler notas GPS sincronizadas: " + e.getMessage());
        }
    }

    private JsonNode firstArray(JsonNode node) {
        Iterator<JsonNode> values = node.elements();
        while (values.hasNext()) {
            JsonNode value = values.next();
            if (value.isArray()) {
                return value;
            }
        }
        return null;
    }

    private Double number(JsonNode node, String... names) {
        for (String name : names) {
            JsonNode value = node.get(name);
            if (value != null && value.isNumber()) {
                return value.asDouble();
            }
            if (value != null && value.isTextual()) {
                try {
                    return Double.parseDouble(value.asText().replace(",", "."));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return null;
    }
}
