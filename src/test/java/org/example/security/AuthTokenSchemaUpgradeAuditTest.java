package org.example.security;

import org.example.Main;
import org.example.dto.AuthRequestDTO;
import org.example.entity.AuthUserEntity;
import org.example.repository.AuthUserRepository;
import org.example.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.test.context.ContextConfiguration;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = Main.class, properties = {
        "recce.test-user.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:auth-upgrade-audit;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.jpa.hibernate.ddl-auto=update",
        "spring.jpa.show-sql=false",
        "recce.storage.type=local"
})
@ContextConfiguration(initializers = AuthTokenSchemaUpgradeAuditTest.LegacySchema.class)
class AuthTokenSchemaUpgradeAuditTest {
    @Autowired private AuthUserRepository users;
    @Autowired private AuthService auth;

    @Test
    void auditSec006OldSchemaAddsNullableExpiryWithoutTrustingTheLegacyToken() {
        AuthUserEntity legacy = users.findById("legacy-user").orElseThrow(AssertionError::new);
        assertNull(legacy.getTokenExpiresAtEpochMillis());
        assertFalse(auth.isTokenValid("legacy-schema-token"));
        AuthRequestDTO login = new AuthRequestDTO();
        login.setEmail("migration@example.test");
        login.setPassword("migration-password");
        String fresh = auth.login(login).getToken();
        assertNotEquals("legacy-schema-token", fresh);
        assertTrue(auth.isTokenValid(fresh));
        assertEquals("legacy-user", users.findByEmailIgnoreCase("migration@example.test")
                .orElseThrow(AssertionError::new).getId());
    }

    static class LegacySchema implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            try (Connection connection = DriverManager.getConnection(
                    context.getEnvironment().getRequiredProperty("spring.datasource.url"), "sa", "")) {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("create table auth_users (id varchar(255) primary key, email varchar(255) not null unique, "
                            + "password_hash varchar(255) not null, token varchar(255) not null, active boolean not null, team_profile_id varchar(255))");
                }
                try (PreparedStatement insert = connection.prepareStatement("insert into auth_users "
                        + "(id,email,password_hash,token,active,team_profile_id) values (?,?,?,?,?,?)")) {
                    insert.setString(1, "legacy-user");
                    insert.setString(2, "migration@example.test");
                    insert.setString(3, BCrypt.hashpw("migration-password", BCrypt.gensalt()));
                    insert.setString(4, "legacy-schema-token");
                    insert.setBoolean(5, true);
                    insert.setString(6, "legacy-team");
                    insert.executeUpdate();
                }
            } catch (Exception exception) {
                throw new IllegalStateException("Could not prepare isolated legacy schema", exception);
            }
        }
    }
}
