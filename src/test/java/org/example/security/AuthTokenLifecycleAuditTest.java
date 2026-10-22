package org.example.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.Main;
import org.example.entity.AuthUserEntity;
import org.example.dto.AuthRequestDTO;
import org.example.service.AuthService;
import org.example.repository.AuthUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.junit.jupiter.api.Assertions.*;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = Main.class, properties = {
        "recce.test-user.enabled=false",
        "recce.auth.token-ttl-seconds=60",
        "spring.datasource.url=jdbc:h2:mem:auth-lifecycle-audit;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false",
        "recce.storage.type=local",
        "recce.upload-dir=target/auth-lifecycle-uploads"
})
@AutoConfigureMockMvc
class AuthTokenLifecycleAuditTest {
    @Autowired private MockMvc http;
    @Autowired private ObjectMapper json;
    @Autowired private AuthUserRepository users;
    @Autowired private AuthService auth;
    @Autowired private org.example.service.TeamProfileService profiles;
    @MockBean private Clock clock;
    private final AtomicLong now = new AtomicLong();

    @BeforeEach
    void setUp() {
        now.set(1700000000000L);
        when(clock.millis()).thenAnswer(invocation -> now.get());
        users.deleteAll();
        AuthUserEntity user = new AuthUserEntity();
        user.setId("lifecycle-user");
        user.setEmail("lifecycle@example.test");
        user.setPasswordHash(BCrypt.hashpw("lifecycle-password", BCrypt.gensalt()));
        user.setToken("legacy-without-expiry");
        user.setTeamProfileId("lifecycle-team");
        users.save(user);
    }

    @Test
    void auditSec006LegacyTokenWithoutExpiryFailsClosed() throws Exception {
        http.perform(get("/api/auth/validate").header("Authorization", "Bearer legacy-without-expiry"))
                .andExpect(status().isUnauthorized());
        http.perform(get("/api/rallies").header("Authorization", "Bearer legacy-without-expiry"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void auditSec006LogoutRevokesTheCredentialAtTheServer() throws Exception {
        String token = login();
        http.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        http.perform(get("/api/auth/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        http.perform(get("/api/rallies").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        assertNull(users.findById("lifecycle-user").orElseThrow(AssertionError::new).getTokenExpiresAtEpochMillis());
        AuthService reconstructed = new AuthService(users, profiles,
                Clock.fixed(Instant.ofEpochMilli(now.get()), ZoneOffset.UTC), 60);
        assertFalse(reconstructed.isTokenValid(token), "Revocation survives reconstructing the service");
        http.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        String replacement = login();
        assertNotEquals(token, replacement);
        assertTrue(auth.isTokenValid(replacement));
    }

    @Test
    void auditSec006LoginRotationRejectsThePreviousToken() throws Exception {
        String oldToken = login();
        String currentToken = login();
        http.perform(get("/api/auth/validate").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized());
        http.perform(get("/api/auth/validate").header("Authorization", "Bearer " + currentToken))
                .andExpect(status().isOk());
        http.perform(post("/api/auth/logout").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isNoContent());
        assertTrue(auth.isTokenValid(currentToken), "A stale logout cannot revoke a new login");
    }

    @Test
    void auditSec006ExpiryIsEnforcedAtTheExactPersistedBoundary() throws Exception {
        String token = login();
        long expires = users.findById("lifecycle-user").orElseThrow(AssertionError::new).getTokenExpiresAtEpochMillis();
        assertEquals(now.get() + 60000L, expires);
        now.set(expires - 1);
        http.perform(get("/api/auth/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
        now.set(expires);
        http.perform(get("/api/auth/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized()).andExpect(header().string("Cache-Control", "no-store"));
        http.perform(get("/api/rallies").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        http.perform(get("/api/pecs/any/audio").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        now.incrementAndGet();
        assertFalse(auth.isTokenValid(token));
        AuthService reconstructed = new AuthService(users, profiles,
                Clock.fixed(Instant.ofEpochMilli(now.get()), ZoneOffset.UTC), 60);
        assertFalse(reconstructed.isTokenValid(token));
        http.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    void auditSec006LogoutOnlyRevokesThePresentedCredential() throws Exception {
        String token = login();
        AuthUserEntity other = new AuthUserEntity();
        other.setId("other-user");
        other.setEmail("other@example.test");
        other.setPasswordHash("unused");
        other.setTeamProfileId("other-team");
        other.setToken("other-token");
        other.setTokenExpiresAtEpochMillis(now.get() + 60000L);
        users.save(other);
        http.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":\"other-user\",\"token\":\"other-token\"}"))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control", "no-store"));
        assertTrue(auth.isTokenValid("other-token"));
        assertFalse(auth.isTokenValid(token));
    }

    @Test
    void auditSec006UnknownAndInactiveTokensCannotAuthenticate() throws Exception {
        http.perform(get("/api/auth/validate").header("Authorization", "Bearer unknown"))
                .andExpect(status().isUnauthorized());
        String token = login();
        AuthUserEntity user = users.findById("lifecycle-user").orElseThrow(AssertionError::new);
        user.setActive(false);
        users.save(user);
        http.perform(get("/api/auth/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        http.perform(get("/api/rallies").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void auditSec006LogoutRequiresBearerSyntaxAndCannotRevokeByQuery() throws Exception {
        String token = login();
        http.perform(post("/api/auth/logout").param("token", token)).andExpect(status().isUnauthorized());
        http.perform(post("/api/auth/logout").header("Authorization", "Basic " + token))
                .andExpect(status().isUnauthorized());
        http.perform(post("/api/auth/logout").header("Authorization", "Bearer "))
                .andExpect(status().isUnauthorized());
        assertTrue(auth.isTokenValid(token));
        http.perform(post("/api/auth/logout").header("Authorization", "Bearer unknown"))
                .andExpect(status().isNoContent());
        assertTrue(auth.isTokenValid(token));
    }

    @Test
    void auditSec006ServiceRegistrationIssuesAnExpiringTokenWithoutEnablingPublicRegistration() throws Exception {
        AuthRequestDTO request = new AuthRequestDTO();
        request.setEmail("new@example.test");
        request.setPassword("new-password");
        String token = auth.register(request).getToken();
        assertTrue(auth.isTokenValid(token));
        assertEquals(Long.valueOf(now.get() + 60000L), users.findByEmailIgnoreCase("new@example.test")
                .orElseThrow(AssertionError::new).getTokenExpiresAtEpochMillis());
        http.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    private String login() throws Exception {
        String response = http.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"lifecycle@example.test\",\"password\":\"lifecycle-password\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }
}
