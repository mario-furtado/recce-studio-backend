package org.example.config;

import org.example.Main;
import org.example.dto.AuthRequestDTO;
import org.example.dto.AuthResponseDTO;
import org.example.entity.AuthUserEntity;
import org.example.repository.AuthUserRepository;
import org.example.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

@SpringBootTest(classes = Main.class, properties = {
        "recce.environment=local",
        "RAILWAY_ENVIRONMENT_NAME=",
        "server.address=127.0.0.1",
        "recce.test-user.enabled=true",
        "recce.test-user.email=bootstrap@example.test",
        "recce.test-user.password=local-bootstrap-fixture",
        "spring.datasource.url=jdbc:h2:mem:bootstrap-audit;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false",
        "recce.storage.type=local",
        "recce.upload-dir=target/bootstrap-audit-uploads"
})
@ActiveProfiles("test")
class TestUserBootstrapPersistenceAuditTest {
    @Autowired
    private AuthUserRepository users;

    @Autowired
    private TestUserBootstrap bootstrap;

    @Autowired
    private AuthService auth;

    @Test
    void auditSec005LocalOptInPersistsAndCanLogInWithoutDuplicatingTheAccount() {
        AuthUserEntity original = users.findByEmailIgnoreCase("bootstrap@example.test").orElseThrow(AssertionError::new);
        assertTrue(original.isActive());
        assertEquals("default", original.getTeamProfileId());
        assertTrue(BCrypt.checkpw("local-bootstrap-fixture", original.getPasswordHash()));
        assertFalse(auth.isTokenValid(original.getToken()), "Bootstrap does not issue an authenticated session");
        assertNull(original.getTokenExpiresAtEpochMillis());

        bootstrap.run();
        AuthUserEntity repeated = users.findByEmailIgnoreCase("bootstrap@example.test").orElseThrow(AssertionError::new);
        assertEquals(1, users.count());
        assertEquals(original.getId(), repeated.getId());
        assertEquals(original.getToken(), repeated.getToken());
        assertNull(repeated.getTokenExpiresAtEpochMillis());
        assertTrue(BCrypt.checkpw("local-bootstrap-fixture", repeated.getPasswordHash()));

        AuthRequestDTO request = new AuthRequestDTO();
        request.setEmail("bootstrap@example.test");
        request.setPassword("local-bootstrap-fixture");
        AuthResponseDTO loggedIn = auth.login(request);
        assertTrue(auth.isTokenValid(loggedIn.getToken()));
        assertEquals(repeated.getId(), users.findByEmailIgnoreCase("bootstrap@example.test")
                .orElseThrow(AssertionError::new).getId());
        assertEquals(1, users.count());
        bootstrap.run();
        assertFalse(auth.isTokenValid(loggedIn.getToken()), "Reprovisioning credentials invalidates the previous session");
    }
}
