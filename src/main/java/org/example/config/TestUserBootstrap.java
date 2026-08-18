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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.UUID;

@Component
public class TestUserBootstrap implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(TestUserBootstrap.class);

    private final AuthUserRepository authUserRepository;
    private final TeamProfileService teamProfileService;
    private final String environment;
    private final String railwayEnvironment;
    private final String enabledOverride;
    private final boolean enabled;
    private final String email;
    private final String password;

    public TestUserBootstrap(
            AuthUserRepository authUserRepository,
            TeamProfileService teamProfileService,
            @Value("${recce.environment:dev}") String environment,
            @Value("${RAILWAY_ENVIRONMENT_NAME:}") String railwayEnvironment,
            @Value("${RECCE_TEST_USER_ENABLED:}") String enabledOverride,
            @Value("${recce.test-user.enabled:false}") boolean enabled,
            @Value("${recce.test-user.email:test@reccestudio.local}") String email,
            @Value("${recce.test-user.password:}") String password) {
        this.authUserRepository = authUserRepository;
        this.teamProfileService = teamProfileService;
        this.environment = environment;
        this.railwayEnvironment = railwayEnvironment;
        this.enabledOverride = enabledOverride;
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
            if (!StringUtils.hasText(enabledOverride)) {
                log.warn("Test user disabled automatically in production environment.");
                return;
            }
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
        return isProductionValue(environment) || isProductionValue(railwayEnvironment);
    }

    private boolean isProductionValue(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase();
        return "prod".equals(normalized) || "production".equals(normalized);
    }

    private String newToken() {
        return UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
    }
}
