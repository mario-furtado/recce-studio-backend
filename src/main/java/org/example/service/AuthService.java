package org.example.service;

import org.example.dto.AuthRequestDTO;
import org.example.dto.AuthResponseDTO;
import org.example.dto.TeamProfileDTO;
import org.example.entity.AuthUserEntity;
import org.example.repository.AuthUserRepository;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.UUID;

@Service
public class AuthService {
    private final AuthUserRepository authUserRepository;
    private final TeamProfileService teamProfileService;

    public AuthService(AuthUserRepository authUserRepository, TeamProfileService teamProfileService) {
        this.authUserRepository = authUserRepository;
        this.teamProfileService = teamProfileService;
    }

    public AuthResponseDTO register(AuthRequestDTO request) {
        validateCredentials(request);
        String email = normalizeEmail(request.getEmail());
        if (authUserRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Este email ja esta registado.");
        }

        TeamProfileDTO profile = new TeamProfileDTO();
        profile.setName(valueOrDefault(request.getTeamName(), "Nova Equipa"));
        profile.setDriverName(valueOrDefault(request.getDriverName(), ""));
        profile.setCoDriverName(valueOrDefault(request.getCoDriverName(), ""));
        profile.setNoteSystem(valueOrDefault(request.getNoteSystem(), "1-6 (1 Lento, 6 Rapido)"));
        profile.setDistanceUnit(valueOrDefault(request.getDistanceUnit(), "Quilometros (km)"));
        TeamProfileDTO savedProfile = teamProfileService.createOrReplaceProfile(profile);

        AuthUserEntity user = new AuthUserEntity();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPasswordHash(BCrypt.hashpw(request.getPassword(), BCrypt.gensalt()));
        user.setToken(newToken());
        user.setTeamProfileId(savedProfile.getId());
        authUserRepository.save(user);

        return new AuthResponseDTO(user.getToken(), user.getEmail(), savedProfile);
    }

    public AuthResponseDTO login(AuthRequestDTO request) {
        validateCredentials(request);
        String email = normalizeEmail(request.getEmail());
        AuthUserEntity user = authUserRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("Credenciais invalidas."));

        if (!user.isActive() || !BCrypt.checkpw(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Credenciais invalidas.");
        }

        user.setToken(newToken());
        authUserRepository.save(user);
        return new AuthResponseDTO(user.getToken(), user.getEmail(), teamProfileService.getProfile());
    }

    public boolean isTokenValid(String token) {
        return StringUtils.hasText(token) && authUserRepository.findByTokenAndActiveTrue(token).isPresent();
    }

    private void validateCredentials(AuthRequestDTO request) {
        if (request == null || !StringUtils.hasText(request.getEmail()) || !StringUtils.hasText(request.getPassword())) {
            throw new IllegalArgumentException("Email e password sao obrigatorios.");
        }
        if (request.getPassword().trim().length() < 6) {
            throw new IllegalArgumentException("A password deve ter pelo menos 6 caracteres.");
        }
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    private String newToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    }

    private String valueOrDefault(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
