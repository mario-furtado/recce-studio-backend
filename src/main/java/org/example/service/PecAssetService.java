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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;

@Service
public class PecAssetService {
    private final PecRepository pecRepository;
    private final OfflineRecceSyncRepository offlineRecceSyncRepository;
    private final ObjectMapper objectMapper;
    private final Path uploadRoot;

    public PecAssetService(
            PecRepository pecRepository,
            OfflineRecceSyncRepository offlineRecceSyncRepository,
            ObjectMapper objectMapper,
            @Value("${recce.upload-dir:uploads}") String uploadDir) {
        this.pecRepository = pecRepository;
        this.offlineRecceSyncRepository = offlineRecceSyncRepository;
        this.objectMapper = objectMapper;
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @Transactional
    public PecAssetDTO saveVideo(String pecId, MultipartFile file) {
        PecEntity pec = getPec(pecId);
        ensureCanEdit(pec);
        String path = storeFile(pecId, "video", file);
        deleteStoredFile(pec.getVideoStoragePath());
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
        deleteStoredFile(pec.getVideoStoragePath());
        pec.setVideoFileName(null);
        pec.setVideoContentType(null);
        pec.setVideoStoragePath(null);
        pec.setUpdatedAt(LocalDate.now());
        return toAssetDTO(pecRepository.save(pec));
    }

    @Transactional
    public PecAssetDTO saveGps(String pecId, MultipartFile file) {
        PecEntity pec = getPec(pecId);
        ensureCanEdit(pec);
        String path = storeFile(pecId, "gps", file);
        deleteStoredFile(pec.getGpsStoragePath());
        pec.setGpsFileName(file.getOriginalFilename());
        pec.setGpsContentType(file.getContentType());
        pec.setGpsStoragePath(path);
        pec.setUpdatedAt(LocalDate.now());
        return toAssetDTO(pecRepository.save(pec));
    }

    public PecAssetDTO getAssets(String pecId) {
        return toAssetDTO(getPec(pecId));
    }

    public Resource getVideoResource(String pecId) {
        PecEntity pec = getPec(pecId);
        if (pec.getVideoStoragePath() == null) {
            throw new RuntimeException("Video nao encontrado para a PEC: " + pecId);
        }
        return new FileSystemResource(pec.getVideoStoragePath());
    }

    public String getVideoContentType(String pecId) {
        PecEntity pec = getPec(pecId);
        return pec.getVideoContentType() != null ? pec.getVideoContentType() : "application/octet-stream";
    }

    public List<GpsPointDTO> getGpsTrack(String pecId) {
        PecEntity pec = getPec(pecId);
        if (pec.getGpsStoragePath() == null) {
            return getOfflineGpsTrack(pecId);
        }

        try {
            File file = new File(pec.getGpsStoragePath());
            String lowerName = file.getName().toLowerCase();
            if (lowerName.endsWith(".gpx") || "application/gpx+xml".equals(pec.getGpsContentType())) {
                return parseGpx(file);
            }
            return parseJson(file);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao ler GPS da PEC: " + e.getMessage());
        }
    }

    public List<ClickMarkerDto> getRecceMarkers(String pecId) {
        getPec(pecId);
        return offlineRecceSyncRepository.findTopByPecIdOrderBySyncedAtDesc(pecId)
                .map(OfflineRecceSyncEntity::getMarkersJson)
                .map(this::parseMarkerJson)
                .orElseGet(ArrayList::new);
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

    private String storeFile(String pecId, String kind, MultipartFile file) {
        try {
            if (file == null || file.isEmpty()) {
                throw new RuntimeException("Ficheiro vazio");
            }
            String original = StringUtils.cleanPath(file.getOriginalFilename() == null ? kind : file.getOriginalFilename());
            String extension = "";
            int dotIndex = original.lastIndexOf('.');
            if (dotIndex >= 0) {
                extension = original.substring(dotIndex);
            }

            Path pecDir = uploadRoot.resolve("pecs").resolve(pecId).normalize();
            Files.createDirectories(pecDir);
            Path target = pecDir.resolve(kind + "-" + UUID.randomUUID() + extension).normalize();
            if (!target.startsWith(uploadRoot)) {
                throw new RuntimeException("Caminho de ficheiro invalido");
            }
            file.transferTo(target.toFile());
            return target.toString();
        } catch (Exception e) {
            throw new RuntimeException("Erro ao guardar ficheiro: " + e.getMessage());
        }
    }

    private void deleteStoredFile(String storagePath) {
        if (storagePath == null) {
            return;
        }
        try {
            Files.deleteIfExists(Paths.get(storagePath));
        } catch (Exception ignored) {
        }
    }

    private PecAssetDTO toAssetDTO(PecEntity pec) {
        PecAssetDTO dto = new PecAssetDTO();
        dto.setHasVideo(pec.getVideoStoragePath() != null);
        dto.setVideoFileName(pec.getVideoFileName());
        dto.setVideoUrl(pec.getVideoStoragePath() != null ? "/api/pecs/" + pec.getId() + "/video" : null);
        dto.setHasGps(pec.getGpsStoragePath() != null);
        dto.setGpsFileName(pec.getGpsFileName());
        dto.setGpsUrl(pec.getGpsStoragePath() != null ? "/api/pecs/" + pec.getId() + "/gps/track" : null);
        return dto;
    }

    private List<GpsPointDTO> parseGpx(File file) throws Exception {
        List<GpsPointDTO> points = new ArrayList<>();
        Document document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(file);
        NodeList nodes = document.getElementsByTagName("trkpt");
        for (int i = 0; i < nodes.getLength(); i++) {
            org.w3c.dom.Node node = nodes.item(i);
            double lat = Double.parseDouble(node.getAttributes().getNamedItem("lat").getNodeValue());
            double lng = Double.parseDouble(node.getAttributes().getNamedItem("lon").getNodeValue());
            points.add(new GpsPointDTO(lat, lng, null, (double) i));
        }
        return points;
    }

    private List<GpsPointDTO> parseJson(File file) throws Exception {
        JsonNode root = objectMapper.readTree(file);
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
            if (lat != null && lng != null) {
                points.add(new GpsPointDTO(lat, lng, speed, timestamp));
            }
        }
        return points;
    }

    private List<GpsPointDTO> getOfflineGpsTrack(String pecId) {
        return offlineRecceSyncRepository.findTopByPecIdOrderBySyncedAtDesc(pecId)
                .map(OfflineRecceSyncEntity::getGpsTrackJson)
                .map(this::parseGpsTrackJson)
                .orElseGet(ArrayList::new);
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
