package org.example.service;

import org.example.dto.TeamProfileDTO;
import org.example.dto.TeamStatsDTO;
import org.example.entity.TeamCarEntity;
import org.example.entity.TeamProfileEntity;
import org.example.repository.PecRepository;
import org.example.repository.RallyRepository;
import org.example.repository.TeamCarRepository;
import org.example.repository.TeamProfileRepository;
import org.example.controller.TenantContext;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Service
public class TeamProfileService {
    private final TeamProfileRepository teamProfileRepository;
    private final PecRepository pecRepository;
    private final RallyRepository rallyRepository;
    private final TeamCarRepository teamCarRepository;
    private final FileStorageService fileStorageService;
    private final TenantContext tenantContext;

    public TeamProfileService(
            TeamProfileRepository teamProfileRepository,
            PecRepository pecRepository,
            RallyRepository rallyRepository,
            TeamCarRepository teamCarRepository,
            FileStorageService fileStorageService,
            TenantContext tenantContext) {
        this.teamProfileRepository = teamProfileRepository;
        this.pecRepository = pecRepository;
        this.rallyRepository = rallyRepository;
        this.teamCarRepository = teamCarRepository;
        this.fileStorageService = fileStorageService;
        this.tenantContext = tenantContext;
    }

    public TeamProfileDTO getProfile() {
        return getProfile(tenantContext.requireTeamProfileId());
    }

    public TeamProfileDTO getProfile(String teamProfileId) {
        ensureDefaultCar(teamProfileId);
        return toDTO(getOrCreateProfile(teamProfileId));
    }

    @Transactional
    public TeamProfileDTO createOrReplaceProfile(TeamProfileDTO dto) {
        return createOrReplaceProfile(tenantContext.requireTeamProfileId(), dto);
    }

    @Transactional
    public TeamProfileDTO createOrReplaceProfile(String teamProfileId, TeamProfileDTO dto) {
        TeamProfileEntity profile = getOrCreateProfile(teamProfileId);
        validateSelectedCar(teamProfileId, dto.getSelectedCarId());
        apply(dto, profile);
        return toDTO(teamProfileRepository.save(profile));
    }

    @Transactional
    public TeamProfileDTO updateProfile(TeamProfileDTO dto) {
        String teamProfileId = tenantContext.requireTeamProfileId();
        TeamProfileEntity profile = getOrCreateProfile(teamProfileId);
        validateSelectedCar(teamProfileId, dto.getSelectedCarId());
        if (dto.getName() != null) profile.setName(dto.getName());
        if (dto.getCar() != null) profile.setCar(dto.getCar());
        if (dto.getCarClass() != null) profile.setCarClass(dto.getCarClass());
        if (dto.getSelectedCarId() != null) profile.setSelectedCarId(dto.getSelectedCarId());
        if (dto.getDriverName() != null) profile.setDriverName(dto.getDriverName());
        if (dto.getCoDriverName() != null) profile.setCoDriverName(dto.getCoDriverName());
        if (dto.getNoteSystem() != null) profile.setNoteSystem(dto.getNoteSystem());
        if (dto.getDistanceUnit() != null) profile.setDistanceUnit(dto.getDistanceUnit());
        return toDTO(teamProfileRepository.save(profile));
    }

    public TeamStatsDTO getStats() {
        return buildStats(tenantContext.requireTeamProfileId());
    }

    public List<TeamCarEntity> getCars() {
        String teamProfileId = tenantContext.requireTeamProfileId();
        ensureDefaultCar(teamProfileId);
        return teamCarRepository.findAllByTeamProfileIdOrderByNameAsc(teamProfileId);
    }

    @Transactional
    public TeamCarEntity createCar(TeamCarEntity car) {
        String teamProfileId = tenantContext.requireTeamProfileId();
        car.setId(UUID.randomUUID().toString());
        car.setTeamProfileId(teamProfileId);
        if (car.getName() == null || car.getName().trim().isEmpty()) {
            throw new RuntimeException("Nome do carro e obrigatorio");
        }
        if (car.getCarClass() == null || car.getCarClass().trim().isEmpty()) {
            car.setCarClass("Rally2");
        }

        TeamCarEntity saved = teamCarRepository.save(car);
        if (teamCarRepository.countByTeamProfileId(teamProfileId) == 1 || saved.isActive()) {
            selectCar(saved.getId());
        }
        return saved;
    }

    @Transactional
    public TeamCarEntity updateCar(String carId, TeamCarEntity data) {
        TeamCarEntity car = teamCarRepository.findByIdAndTeamProfileId(carId, tenantContext.requireTeamProfileId())
                .orElseThrow(() -> new ResourceNotFoundException("Carro nao encontrado com ID: " + carId));
        if (data.getName() != null) car.setName(data.getName());
        if (data.getCarClass() != null) car.setCarClass(data.getCarClass());
        if (data.getNotes() != null) car.setNotes(data.getNotes());
        car.setActive(data.isActive());
        TeamCarEntity saved = teamCarRepository.save(car);
        if (saved.isActive()) {
            selectCar(saved.getId());
        }
        return saved;
    }

    public TeamCarEntity uploadCarPhoto(String carId, MultipartFile file) {
        TeamCarEntity car = teamCarRepository.findByIdAndTeamProfileId(carId, tenantContext.requireTeamProfileId())
                .orElseThrow(() -> new ResourceNotFoundException("Carro nao encontrado com ID: " + carId));
        validateImage(file);
        String previousPath = car.getPhotoStoragePath();
        String path = fileStorageService.store(file, "cars/" + carId, "car-photo");
        car.setPhotoFileName(file.getOriginalFilename());
        car.setPhotoContentType(file.getContentType());
        car.setPhotoStoragePath(path);
        TeamCarEntity saved = teamCarRepository.save(car);
        fileStorageService.delete(previousPath);
        return saved;
    }

    public Resource getCarPhotoResource(String carId) {
        TeamCarEntity car = requireOwnedCar(carId);
        if (car.getPhotoStoragePath() == null) {
            throw new RuntimeException("Fotografia do carro nao encontrada");
        }
        return fileStorageService.loadAsResource(car.getPhotoStoragePath());
    }

    public byte[] getCarPhotoBytes(String carId) {
        TeamCarEntity car = requireOwnedCar(carId);
        if (car.getPhotoStoragePath() == null) {
            throw new RuntimeException("Fotografia do carro nao encontrada");
        }
        return fileStorageService.loadBytes(car.getPhotoStoragePath());
    }

    public String getCarPhotoContentType(String carId) {
        TeamCarEntity car = requireOwnedCar(carId);
        return car.getPhotoContentType() != null ? car.getPhotoContentType() : "application/octet-stream";
    }

    @Transactional
    public TeamProfileDTO selectCar(String carId) {
        String teamProfileId = tenantContext.requireTeamProfileId();
        TeamCarEntity selected = teamCarRepository.findByIdAndTeamProfileId(carId, teamProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Carro nao encontrado com ID: " + carId));

        for (TeamCarEntity car : teamCarRepository.findAllByTeamProfileIdOrderByNameAsc(teamProfileId)) {
            car.setActive(car.getId().equals(carId));
            teamCarRepository.save(car);
        }

        TeamProfileEntity profile = getOrCreateProfile(teamProfileId);
        profile.setSelectedCarId(selected.getId());
        profile.setCar(selected.getName());
        profile.setCarClass(selected.getCarClass());
        return toDTO(teamProfileRepository.save(profile));
    }

    @Transactional
    public void deleteCar(String carId) {
        String teamProfileId = tenantContext.requireTeamProfileId();
        TeamCarEntity car = teamCarRepository.findByIdAndTeamProfileId(carId, teamProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Carro nao encontrado com ID: " + carId));
        String photoPath = car.getPhotoStoragePath();
        teamCarRepository.deleteById(carId);
        fileStorageService.delete(photoPath);
        TeamProfileEntity profile = getOrCreateProfile(teamProfileId);
        if (carId.equals(profile.getSelectedCarId())) {
            profile.setSelectedCarId(null);
            profile.setCar(null);
            profile.setCarClass(null);
            teamProfileRepository.save(profile);
        }
    }

    public TeamProfileDTO uploadLogo(MultipartFile file) {
        TeamProfileEntity profile = getOrCreateProfile(tenantContext.requireTeamProfileId());
        validateImage(file);
        String previousPath = profile.getLogoStoragePath();
        String path = fileStorageService.store(file, "team-profile", "logo");
        profile.setLogoFileName(file.getOriginalFilename());
        profile.setLogoContentType(file.getContentType());
        profile.setLogoStoragePath(path);
        TeamProfileDTO saved = toDTO(teamProfileRepository.save(profile));
        fileStorageService.delete(previousPath);
        return saved;
    }

    public Resource getLogoResource() {
        TeamProfileEntity profile = getOrCreateProfile(tenantContext.requireTeamProfileId());
        if (profile.getLogoStoragePath() == null) {
            throw new RuntimeException("Imagem do perfil nao encontrada");
        }
        return fileStorageService.loadAsResource(profile.getLogoStoragePath());
    }

    public byte[] getLogoBytes() {
        TeamProfileEntity profile = getOrCreateProfile(tenantContext.requireTeamProfileId());
        if (profile.getLogoStoragePath() == null) {
            throw new RuntimeException("Imagem do perfil nao encontrada");
        }
        return fileStorageService.loadBytes(profile.getLogoStoragePath());
    }

    public String getLogoContentType() {
        TeamProfileEntity profile = getOrCreateProfile(tenantContext.requireTeamProfileId());
        return profile.getLogoContentType() != null ? profile.getLogoContentType() : "application/octet-stream";
    }

    private TeamProfileEntity getOrCreateProfile(String teamProfileId) {
        return teamProfileRepository.findById(teamProfileId)
                .orElseGet(() -> teamProfileRepository.save(defaultProfile(teamProfileId)));
    }

    private TeamCarEntity requireOwnedCar(String carId) {
        return teamCarRepository.findByIdAndTeamProfileId(carId, tenantContext.requireTeamProfileId())
                .orElseThrow(() -> new ResourceNotFoundException("Carro nao encontrado com ID: " + carId));
    }

    private void validateSelectedCar(String teamProfileId, String selectedCarId) {
        if (selectedCarId == null || selectedCarId.trim().isEmpty()) {
            return;
        }
        teamCarRepository.findByIdAndTeamProfileId(selectedCarId, teamProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Carro nao encontrado com ID: " + selectedCarId));
    }

    private TeamProfileEntity defaultProfile(String teamProfileId) {
        TeamProfileEntity profile = new TeamProfileEntity();
        profile.setId(teamProfileId);
        profile.setName("Recce Studio Racing");
        profile.setCar("Skoda Fabia RS");
        profile.setCarClass("Rally2");
        profile.setDriverName("Joao Silva");
        profile.setCoDriverName("Miguel Furtado");
        profile.setNoteSystem("1-6 (1 Lento, 6 Rapido)");
        profile.setDistanceUnit("Quilometros (km)");
        return profile;
    }

    private void apply(TeamProfileDTO dto, TeamProfileEntity profile) {
        profile.setName(valueOrDefault(dto.getName(), profile.getName()));
        profile.setCar(valueOrDefault(dto.getCar(), profile.getCar()));
        profile.setCarClass(valueOrDefault(dto.getCarClass(), profile.getCarClass()));
        profile.setSelectedCarId(valueOrDefault(dto.getSelectedCarId(), profile.getSelectedCarId()));
        profile.setDriverName(valueOrDefault(dto.getDriverName(), profile.getDriverName()));
        profile.setCoDriverName(valueOrDefault(dto.getCoDriverName(), profile.getCoDriverName()));
        profile.setNoteSystem(valueOrDefault(dto.getNoteSystem(), profile.getNoteSystem()));
        profile.setDistanceUnit(valueOrDefault(dto.getDistanceUnit(), profile.getDistanceUnit()));
    }

    private String valueOrDefault(String value, String fallback) {
        return value != null ? value : fallback;
    }

    private TeamProfileDTO toDTO(TeamProfileEntity profile) {
        TeamProfileDTO dto = new TeamProfileDTO();
        dto.setId(profile.getId());
        dto.setName(profile.getName());
        dto.setCar(profile.getCar());
        dto.setCarClass(profile.getCarClass());
        dto.setSelectedCarId(profile.getSelectedCarId());
        dto.setDriverName(profile.getDriverName());
        dto.setCoDriverName(profile.getCoDriverName());
        dto.setNoteSystem(profile.getNoteSystem());
        dto.setDistanceUnit(profile.getDistanceUnit());
        dto.setLogoFileName(profile.getLogoFileName());
        dto.setLogoUrl(profile.getLogoStoragePath() != null ? "/api/team-profile/logo" : null);
        TeamStatsDTO stats = buildStats(profile.getId());
        dto.setTotalPecs(stats.getTotalPecs());
        dto.setTotalKm(stats.getTotalKm());
        dto.setActiveEvents(stats.getActiveEvents());
        return dto;
    }

    private TeamStatsDTO buildStats(String teamProfileId) {
        TeamProfileEntity profile = getOrCreateProfile(teamProfileId);
        String selectedCarId = profile.getSelectedCarId();

        if (selectedCarId == null || selectedCarId.trim().isEmpty()) {
            double totalKm = pecRepository.findByRallyTeamProfileId(teamProfileId)
                    .stream()
                    .mapToDouble(pec -> pec.getDistanceKm())
                    .sum();
            long activeEvents = rallyRepository.findByTeamProfileId(teamProfileId)
                    .stream()
                    .filter(rally -> !"COMPLETED".equalsIgnoreCase(rally.getStatus()))
                    .count();
            return new TeamStatsDTO(pecRepository.findByRallyTeamProfileId(teamProfileId).size(), totalKm, activeEvents);
        }

        List<org.example.entity.RallyEntity> carRallies = rallyRepository.findByTeamProfileId(teamProfileId)
                .stream()
                .filter(rally -> selectedCarId.equals(rally.getCarId()))
                .collect(java.util.stream.Collectors.toList());

        long totalPecs = 0;
        double totalKm = 0.0;
        for (org.example.entity.RallyEntity rally : carRallies) {
            String rallyId = rally.getId();
            totalPecs += pecRepository.countByRallyId(rallyId);
            totalKm += pecRepository.findByRallyId(rallyId)
                    .stream()
                    .mapToDouble(pec -> pec.getDistanceKm())
                    .sum();
        }

        long activeEvents = carRallies.stream()
                .filter(rally -> !"COMPLETED".equalsIgnoreCase(rally.getStatus()))
                .count();

        return new TeamStatsDTO(totalPecs, totalKm, activeEvents);
    }

    private void ensureDefaultCar(String teamProfileId) {
        if (teamCarRepository.countByTeamProfileId(teamProfileId) > 0) {
            return;
        }
        TeamCarEntity car = new TeamCarEntity();
        car.setId(UUID.randomUUID().toString());
        car.setTeamProfileId(teamProfileId);
        car.setName("Skoda Fabia RS");
        car.setCarClass("Rally2");
        car.setActive(true);
        teamCarRepository.save(car);

        TeamProfileEntity profile = getOrCreateProfile(teamProfileId);
        profile.setSelectedCarId(car.getId());
        profile.setCar(car.getName());
        profile.setCarClass(car.getCarClass());
        teamProfileRepository.save(profile);
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("Ficheiro vazio");
        }
        String contentType = file.getContentType();
        if (!isBrowserSupportedImage(contentType)) {
            throw new RuntimeException("A imagem deve estar em JPG, PNG, WebP ou GIF.");
        }
    }

    private boolean isBrowserSupportedImage(String contentType) {
        return "image/jpeg".equalsIgnoreCase(contentType)
                || "image/png".equalsIgnoreCase(contentType)
                || "image/webp".equalsIgnoreCase(contentType)
                || "image/gif".equalsIgnoreCase(contentType);
    }
}
