package org.example.service;

import org.example.dto.AuthRequestDTO;
import org.example.dto.AuthResponseDTO;
import org.example.dto.TeamProfileDTO;
import org.example.entity.AuthUserEntity;
import org.example.repository.AuthUserRepository;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;

import java.util.UUID;
import java.util.Optional;
import java.time.Clock;

@Service
public class AuthService {
    private final AuthUserRepository authUserRepository;
    private final TeamProfileService teamProfileService;
    private final Clock clock;
    private final long tokenTtlMillis;

    public AuthService(AuthUserRepository authUserRepository, TeamProfileService teamProfileService,
                       Clock clock, @Value("${recce.auth.token-ttl-seconds:28800}") long tokenTtlSeconds) {
        if (tokenTtlSeconds <= 0) {
            throw new IllegalArgumentException("A validade dos tokens deve ser positiva.");
        }
        this.authUserRepository = authUserRepository;
        this.teamProfileService = teamProfileService;
        this.clock = clock;
        this.tokenTtlMillis = Math.multiplyExact(tokenTtlSeconds, 1000L);
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
        String teamProfileId = UUID.randomUUID().toString();
        TeamProfileDTO savedProfile = teamProfileService.createOrReplaceProfile(teamProfileId, profile);

        AuthUserEntity user = new AuthUserEntity();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPasswordHash(BCrypt.hashpw(request.getPassword(), BCrypt.gensalt()));
        issueToken(user);
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

        issueToken(user);
        authUserRepository.save(user);
        return new AuthResponseDTO(user.getToken(), user.getEmail(), teamProfileService.getProfile(user.getTeamProfileId()));
    }

    public boolean isTokenValid(String token) {
        return findActiveUserByToken(token)
                .map(AuthUserEntity::getTeamProfileId)
                .filter(StringUtils::hasText)
                .isPresent();
    }

    public Optional<AuthUserEntity> findActiveUserByToken(String token) {
        if (!StringUtils.hasText(token)) {
            return Optional.empty();
        }
        return authUserRepository.findByTokenAndActiveTrue(token)
                .filter(user -> user.getTokenExpiresAtEpochMillis() != null
                        && user.getTokenExpiresAtEpochMillis() > clock.millis());
    }

    public void logout(String token) {
        if (StringUtils.hasText(token)) {
            authUserRepository.revokeToken(token);
        }
    }

    private void issueToken(AuthUserEntity user) {
        user.setToken(newToken());
        user.setTokenExpiresAtEpochMillis(Math.addExact(clock.millis(), tokenTtlMillis));
    }

    public String getEmailFromAuthorization(String authorization) {
        String token = extractBearerToken(authorization);
        return findActiveUserByToken(token)
                .map(AuthUserEntity::getEmail)
                .orElseThrow(() -> new IllegalArgumentException("Sessao invalida ou expirada."));
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

    private String extractBearerToken(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith("Bearer ")) {
            return null;
        }
        return authorization.substring("Bearer ".length()).trim();
    }

    private String newToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    }

    private String valueOrDefault(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
