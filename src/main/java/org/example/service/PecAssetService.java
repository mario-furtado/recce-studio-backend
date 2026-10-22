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
import org.example.controller.TenantContext;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;
import org.xml.sax.helpers.DefaultHandler;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@Service
public class PecAssetService {
    private static final int MAX_GPX_BYTES = 10 * 1024 * 1024;
    private static final int MAX_GPX_DEPTH = 64;
    private final PecRepository pecRepository;
    private final OfflineRecceSyncRepository offlineRecceSyncRepository;
    private final ObjectMapper objectMapper;
    private final FileStorageService fileStorageService;
    private final TenantContext tenantContext;

    public PecAssetService(
            PecRepository pecRepository,
            OfflineRecceSyncRepository offlineRecceSyncRepository,
            ObjectMapper objectMapper,
            FileStorageService fileStorageService,
            TenantContext tenantContext) {
        this.pecRepository = pecRepository;
        this.offlineRecceSyncRepository = offlineRecceSyncRepository;
        this.objectMapper = objectMapper;
        this.fileStorageService = fileStorageService;
        this.tenantContext = tenantContext;
    }

    @Transactional
    public PecAssetDTO saveVideo(String pecId, MultipartFile file) {
        PecEntity pec = getOwnedPec(pecId);
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
        PecEntity pec = getOwnedPec(pecId);
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
        PecEntity pec = getOwnedPec(pecId);
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
        PecEntity pec = getOwnedPec(pecId);
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
        PecEntity pec = getOwnedPec(pecId);
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
        return toAssetDTO(getOwnedPec(pecId));
    }

    @Transactional(readOnly = true)
    public Resource getVideoResource(String pecId) {
        PecEntity pec = getOwnedPec(pecId);
        if (pec.getVideoStoragePath() == null) {
            throw new RuntimeException("Video nao encontrado para a PEC: " + pecId);
        }
        return fileStorageService.loadAsResource(pec.getVideoStoragePath());
    }

    @Transactional(readOnly = true)
    public String getVideoContentType(String pecId) {
        PecEntity pec = getOwnedPec(pecId);
        return pec.getVideoContentType() != null ? pec.getVideoContentType() : "application/octet-stream";
    }

    @Transactional(readOnly = true)
    public Resource getAudioResource(String pecId) {
        PecEntity pec = getOwnedPec(pecId);
        if (pec.getAudioStoragePath() == null) {
            throw new RuntimeException("Audio nao encontrado para a PEC: " + pecId);
        }
        return fileStorageService.loadAsResource(pec.getAudioStoragePath());
    }

    @Transactional(readOnly = true)
    public byte[] getAudioBytes(String pecId) {
        PecEntity pec = getOwnedPec(pecId);
        if (pec.getAudioStoragePath() == null) {
            throw new RuntimeException("Audio nao encontrado para a PEC: " + pecId);
        }
        return fileStorageService.loadBytes(pec.getAudioStoragePath());
    }

    @Transactional(readOnly = true)
    public String getAudioContentType(String pecId) {
        PecEntity pec = getOwnedPec(pecId);
        return pec.getAudioContentType() != null ? pec.getAudioContentType() : "application/octet-stream";
    }

    @Transactional(readOnly = true)
    public List<GpsPointDTO> getGpsTrack(String pecId) {
        PecEntity pec = getOwnedPec(pecId);
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
        } catch (SAXException | NumberFormatException e) {
            throw new IllegalArgumentException("Ficheiro GPX invalido ou nao permitido.", e);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao ler GPS da PEC: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<ClickMarkerDto> getRecceMarkers(String pecId) {
        getOwnedPec(pecId);
        for (OfflineRecceSyncEntity sync : offlineRecceSyncRepository
                .findByPecIdAndTeamProfileIdOrderBySyncedAtDesc(pecId, tenantContext.requireTeamProfileId())) {
            List<ClickMarkerDto> markers = safeParseMarkerJson(sync.getMarkersJson());
            if (!markers.isEmpty()) {
                return markers;
            }
        }
        return new ArrayList<>();
    }


    private PecEntity getOwnedPec(String pecId) {
        return pecRepository.findByIdAndRallyTeamProfileId(pecId, tenantContext.requireTeamProfileId())
                .orElseThrow(() -> new ResourceNotFoundException("PEC nao encontrada com ID: " + pecId));
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
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setAttribute("http://www.oracle.com/xml/jaxp/properties/maxElementDepth", String.valueOf(MAX_GPX_DEPTH));
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        builder.setEntityResolver((publicId, systemId) -> {
            throw new SAXException("Referencias XML externas nao permitidas.");
        });
        builder.setErrorHandler(new DefaultHandler() {
            @Override
            public void error(SAXParseException exception) throws SAXException {
                throw exception;
            }

            @Override
            public void fatalError(SAXParseException exception) throws SAXException {
                throw exception;
            }
        });

        ByteArrayOutputStream boundedInput = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int bytesRead;
        while ((bytesRead = inputStream.read(buffer)) != -1) {
            if (bytesRead > MAX_GPX_BYTES - boundedInput.size()) {
                throw new SAXException("O ficheiro GPX excede o limite permitido.");
            }
            boundedInput.write(buffer, 0, bytesRead);
        }
        List<GpsPointDTO> points = new ArrayList<>();
        Document document = builder.parse(new ByteArrayInputStream(boundedInput.toByteArray()));
        NodeList nodes = document.getElementsByTagName("trkpt");
        for (int i = 0; i < nodes.getLength(); i++) {
            org.w3c.dom.Node node = nodes.item(i);
            if (node.getAttributes().getNamedItem("lat") == null || node.getAttributes().getNamedItem("lon") == null) {
                throw new SAXException("Coordenadas GPX em falta.");
            }
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
        for (OfflineRecceSyncEntity sync : offlineRecceSyncRepository
                .findByPecIdAndTeamProfileIdOrderBySyncedAtDesc(pecId, tenantContext.requireTeamProfileId())) {
            List<GpsPointDTO> track = safeParseGpsTrackJson(sync.getGpsTrackJson());
            if (!track.isEmpty()) {
                return track;
            }
        }
        return new ArrayList<>();
    }

    private boolean hasSyncedGps(String pecId) {
        for (OfflineRecceSyncEntity sync : offlineRecceSyncRepository
                .findByPecIdAndTeamProfileIdOrderBySyncedAtDesc(pecId, tenantContext.requireTeamProfileId())) {
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
