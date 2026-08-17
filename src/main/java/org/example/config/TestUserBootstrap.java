package org.example.config;

import org.example.dto.TeamProfileDTO;
import org.example.entity.AuthUserEntity;
import org.example.repository.AuthUserRepository;
import org.example.service.TeamProfileService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.UUID;

@Component
public class TestUserBootstrap implements CommandLineRunner {
    private final AuthUserRepository authUserRepository;
    private final TeamProfileService teamProfileService;
    private final String environment;
    private final boolean enabled;
    private final String email;
    private final String password;

    public TestUserBootstrap(
            AuthUserRepository authUserRepository,
            TeamProfileService teamProfileService,
            @Value("${recce.environment:dev}") String environment,
            @Value("${recce.test-user.enabled:false}") boolean enabled,
            @Value("${recce.test-user.email:test@reccestudio.local}") String email,
            @Value("${recce.test-user.password:}") String password) {
        this.authUserRepository = authUserRepository;
        this.teamProfileService = teamProfileService;
        this.environment = environment;
        this.enabled = enabled;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            return;
        }

        if (isProductionEnvironment()) {
            throw new IllegalStateException("RECCE_TEST_USER_ENABLED nao pode estar ativo em PROD.");
        }

        if (!StringUtils.hasText(email) || !StringUtils.hasText(password)) {
            throw new IllegalStateException("Defina RECCE_TEST_USER_EMAIL e RECCE_TEST_USER_PASSWORD para ativar o user de teste.");
        }

        if (password.trim().length() < 6) {
            throw new IllegalStateException("RECCE_TEST_USER_PASSWORD deve ter pelo menos 6 caracteres.");
        }

        TeamProfileDTO profile = teamProfileService.getProfile();
        String normalizedEmail = email.trim().toLowerCase();
        AuthUserEntity user = authUserRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseGet(() -> {
                    AuthUserEntity created = new AuthUserEntity();
                    created.setId(UUID.randomUUID().toString());
                    created.setToken(newToken());
                    return created;
                });

        user.setEmail(normalizedEmail);
        user.setPasswordHash(BCrypt.hashpw(password, BCrypt.gensalt()));
        user.setActive(true);
        user.setTeamProfileId(profile.getId());
        if (!StringUtils.hasText(user.getToken())) {
            user.setToken(newToken());
        }
        authUserRepository.save(user);
    }

    private boolean isProductionEnvironment() {
        String value = environment == null ? "" : environment.trim().toLowerCase();
        return "prod".equals(value) || "production".equals(value);
    }

    private String newToken() {
        return UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
    }
}
