package org.example.config;

import org.example.dto.TeamProfileDTO;
import org.example.entity.AuthUserEntity;
import org.example.repository.AuthUserRepository;
import org.example.service.TeamProfileService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;

@Component
@Order(0)
public class TestUserBootstrap implements CommandLineRunner {
    private final AuthUserRepository authUserRepository;
    private final TeamProfileService teamProfileService;
    private final String environment;
    private final String railwayEnvironment;
    private final String bindAddress;
    private final Environment springEnvironment;
    private final boolean enabled;
    private final String email;
    private final String password;

    public TestUserBootstrap(
            AuthUserRepository authUserRepository,
            TeamProfileService teamProfileService,
            @Value("${recce.environment:dev}") String environment,
            @Value("${RAILWAY_ENVIRONMENT_NAME:}") String railwayEnvironment,
            @Value("${server.address:}") String bindAddress,
            @Value("${recce.test-user.enabled:false}") boolean enabled,
            @Value("${recce.test-user.email:}") String email,
            @Value("${recce.test-user.password:}") String password,
            Environment springEnvironment) {
        this.authUserRepository = authUserRepository;
        this.teamProfileService = teamProfileService;
        this.environment = environment;
        this.railwayEnvironment = railwayEnvironment;
        this.bindAddress = bindAddress;
        this.springEnvironment = springEnvironment;
        this.enabled = enabled;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            return;
        }

        if (!isSafeLocalEnvironment()) {
            throw new IllegalStateException("O user de teste exige ambiente local de desenvolvimento/teste e bind de loopback, sem Railway.");
        }

        if (!StringUtils.hasText(email) || !StringUtils.hasText(password)) {
            throw new IllegalStateException("Defina RECCE_TEST_USER_EMAIL e RECCE_TEST_USER_PASSWORD para ativar o user de teste.");
        }

        if (password.trim().length() < 6) {
            throw new IllegalStateException("RECCE_TEST_USER_PASSWORD deve ter pelo menos 6 caracteres.");
        }

        TeamProfileDTO profile = teamProfileService.getProfile("default");
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
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
        user.setTokenExpiresAtEpochMillis(null);
        authUserRepository.save(user);
    }

    private boolean isSafeLocalEnvironment() {
        if (StringUtils.hasText(railwayEnvironment) || !isLocalValue(environment)) {
            return false;
        }
        String[] profiles = springEnvironment.getActiveProfiles();
        if (profiles.length == 0) {
            profiles = springEnvironment.getDefaultProfiles();
        }
        if (!Arrays.stream(profiles).allMatch(profile -> "default".equals(profile) || isLocalValue(profile))) {
            return false;
        }
        return Arrays.asList("127.0.0.1", "::1", "0:0:0:0:0:0:0:1", "localhost")
                .contains(bindAddress == null ? "" : bindAddress.trim().toLowerCase(Locale.ROOT));
    }

    private boolean isLocalValue(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return Arrays.asList("local", "dev", "development", "test").contains(normalized);
    }

    private String newToken() {
        return UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
    }
}
