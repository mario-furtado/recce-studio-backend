package org.example.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.Main;
import org.example.entity.AuthUserEntity;
import org.example.entity.RallyReadGrantEntity;
import org.example.repository.*;
import org.example.service.AccountMailer;
import org.example.service.AccountRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = Main.class, properties = {
        "recce.test-user.enabled=false", "recce.account.enabled=true", "recce.crews.enabled=true",
        "recce.invitations.enabled=true", "spring.datasource.url=jdbc:h2:mem:invitations;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false", "recce.storage.type=local"
})
@AutoConfigureMockMvc
class RallyInvitationIntegrationTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired AuthUserRepository users;
    @Autowired RallyInvitationRepository invitations;
    @Autowired RallyReadGrantRepository grants;
    @Autowired RallyRepository rallies;
    @Autowired CrewRepository crews;
    @Autowired JdbcTemplate jdbc;
    @Autowired InvitationQuotaRepository quotas;
    @Autowired AccountRateLimitRepository rateLimits;
    @MockBean Clock clock;
    @MockBean AccountMailer mail;

    private final AtomicLong now = new AtomicLong();
    private String crew, rally, sibling;
    private static final String OWNER = "token-owner";
    private static final String READER = "token-reader";
    private static final String STRANGER = "token-stranger";

    @BeforeEach
    void setup() throws Exception {
        invitations.deleteAll();
        grants.deleteAll();
        rallies.deleteAll();
        crews.deleteAll();
        users.deleteAll();
        quotas.deleteAll();
        rateLimits.deleteByIdNot(AccountRateLimiter.GUARD);
        now.set(1800000000000L);
        when(clock.millis()).thenAnswer(call -> now.get());
        user("owner", "owner@invites.invalid", OWNER, true);
        user("reader", "reader@invites.invalid", READER, true);
        user("stranger", "stranger@invites.invalid", STRANGER, true);
        crew = body(call(post("/api/crews").header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Invitation crew\"}"), OWNER)
                .andExpect(status().isOk())).path("id").asText();
        rally = createRally("Rali autorizado");
        sibling = createRally("Rali privado");
    }

    @Test
    void onlyVerifiedRecipientCanAcceptAndReadExactlyOneRally() throws Exception {
        call(get("/api/invitations/options"), READER).andExpect(jsonPath("$.enabled").value(true));
        send(rally, "reader@invites.invalid", READER).andExpect(status().isNotFound());
        send(rally, "reader@invites.invalid", OWNER).andExpect(status().isAccepted());
        String id = invitationId(rally);
        call(get("/api/notifications"), STRANGER).andExpect(jsonPath("$.items.length()").value(0));
        call(get("/api/invitations/" + id), STRANGER).andExpect(status().isNotFound());
        call(patch("/api/notifications/" + id + "/read"), STRANGER).andExpect(status().isNotFound());
        call(post("/api/invitations/" + id + "/accept").header("X-Crew-Id", crew), STRANGER).andExpect(status().isNotFound());
        http.perform(post("/api/invitations/" + id + "/accept").param("token", READER)).andExpect(status().isUnauthorized());
        call(get("/api/shared-rallies/" + rally), READER).andExpect(status().isNotFound());
        call(get("/api/notifications"), READER).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.unread").value(1)).andExpect(jsonPath("$.items[0].recipientEmail").doesNotExist());
        call(get("/api/invitations/" + id), READER).andExpect(jsonPath("$.state").value("PENDING"));
        call(get("/api/notifications/unread"), READER).andExpect(jsonPath("$.unread").value(1));
        call(get("/api/notifications/unread"), STRANGER).andExpect(jsonPath("$.unread").value(0));
        call(patch("/api/notifications/" + id + "/read"), READER).andExpect(jsonPath("$.read").value(true));
        call(patch("/api/notifications/" + id + "/read"), READER).andExpect(jsonPath("$.read").value(true));
        call(get("/api/notifications"), READER).andExpect(jsonPath("$.unread").value(0));
        assertEquals(0, grants.count());

        call(post("/api/invitations/" + id + "/accept").contentType(MediaType.APPLICATION_JSON)
                .content("{\"rallyId\":\"" + sibling + "\",\"role\":\"OWNER\"}"), READER)
                .andExpect(jsonPath("$.state").value("ACCEPTED")).andExpect(jsonPath("$.rallyId").value(rally));
        call(post("/api/invitations/" + id + "/accept"), READER).andExpect(jsonPath("$.state").value("ACCEPTED"));
        send(rally, "reader@invites.invalid", OWNER).andExpect(status().isAccepted());
        assertEquals(1, invitations.count());
        assertEquals(1, grants.count());
        RallyReadGrantEntity grant = grants.findByRecipientIdAndRallyId("reader", rally).get();
        assertEquals(id, grant.getSourceInvitationId());
        assertEquals(now.get(), grant.getIssuedAt().longValue());
        call(get("/api/shared-rallies/" + rally), READER).andExpect(status().isOk());
        call(get("/api/shared-rallies/" + sibling), READER).andExpect(status().isNotFound());
        call(put("/api/rallies/" + rally).header("X-Crew-Id", crew), READER).andExpect(status().isNotFound());
        verifyNoInteractions(mail);
    }

    @Test
    void duplicateKeepsExpiryAndTerminalTransitionsCannotCreateGrants() throws Exception {
        send(rally, "  Reader@Invites.invalid  ", OWNER).andExpect(status().isAccepted());
        String id = invitationId(rally);
        long expires = invitations.findById(id).get().getExpiresAt();
        now.addAndGet(Duration.ofDays(1).toMillis());
        send(rally, "reader@invites.invalid", OWNER).andExpect(status().isAccepted());
        assertEquals(expires, invitations.findById(invitationId(rally)).get().getExpiresAt());
        assertEquals(1, invitations.count());
        call(post("/api/invitations/" + id + "/decline"), READER).andExpect(jsonPath("$.state").value("DECLINED"));
        call(post("/api/invitations/" + id + "/decline"), READER).andExpect(status().isOk());
        call(post("/api/invitations/" + id + "/accept"), READER).andExpect(status().isConflict());
        now.incrementAndGet();
        send(rally, "reader@invites.invalid", OWNER).andExpect(status().isAccepted());
        String newer = invitationId(rally);
        assertNotEquals(id, newer);
        call(post(cancel(sibling, newer)), OWNER).andExpect(status().isNotFound());
        call(post(cancel(rally, newer)), STRANGER).andExpect(status().isNotFound());
        call(post(cancel(rally, newer)), OWNER).andExpect(status().isNoContent());
        call(post(cancel(rally, newer)), OWNER).andExpect(status().isNoContent());
        call(get("/api/invitations/" + newer), READER).andExpect(jsonPath("$.state").value("CANCELLED"));
        call(post("/api/invitations/" + newer + "/accept"), READER).andExpect(status().isConflict());
        send(sibling, "reader@invites.invalid", OWNER).andExpect(status().isAccepted());
        String expiring = invitationId(sibling);
        now.set(invitations.findById(expiring).get().getExpiresAt());
        call(get("/api/invitations/" + expiring), READER).andExpect(jsonPath("$.state").value("EXPIRED"));
        call(post("/api/invitations/" + expiring + "/accept"), READER).andExpect(status().isConflict());
        assertEquals(0, grants.count());
    }

    @Test
    void deliveryAfterRealVerificationAndImmutableBinding() throws Exception {
        long accounts = users.count();
        String known = send(rally, "reader@invites.invalid", OWNER).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        String boundId = invitationId(rally);
        String unknown = send(sibling, "new@invites.invalid", OWNER).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        assertEquals(known, unknown);
        assertEquals(accounts, users.count());
        verifyNoInteractions(mail);
        String pending = invitationId(sibling);
        assertNull(invitations.findById(pending).get().getRecipientId());
        AtomicReference<String> proof = new AtomicReference<>();
        when(mail.isConfigured()).thenReturn(true);
        doAnswer(call -> { proof.set(call.getArgument(2)); return null; }).when(mail).send(eq("new@invites.invalid"), eq("VERIFY"), anyString());
        publicBody("/api/auth/register", json.createObjectNode().put("email", "new@invites.invalid")).andExpect(status().isAccepted());
        assertEquals(accounts, users.count());
        String password = "verified-invite-test-2026";
        publicBody("/api/auth/verify-email", json.createObjectNode().put("token", proof.get()).put("password", password))
                .andExpect(status().isNoContent());
        String token = body(publicBody("/api/auth/login", json.createObjectNode().put("email", "new@invites.invalid").put("password", password))
                .andExpect(status().isOk())).path("token").asText();
        call(get("/api/notifications"), token).andExpect(jsonPath("$.items[0].id").value(pending));
        call(post("/api/invitations/" + pending + "/accept"), token).andExpect(jsonPath("$.state").value("ACCEPTED"));
        assertNotNull(invitations.findById(pending).get().getRecipientId());
        assertNull(users.findByEmailIgnoreCase("new@invites.invalid").get().getTeamProfileId());
        users.deleteById("reader");
        user("replacement", "reader@invites.invalid", "token-replacement", true);
        call(get("/api/invitations/" + boundId), "token-replacement").andExpect(status().isNotFound());
        call(post("/api/invitations/" + boundId + "/accept"), "token-replacement").andExpect(status().isNotFound());
        assertEquals(1, grants.count());
    }

    @Test
    void quotaIsGlobalToTheOwnerAndSurvivesRallyDeletion() throws Exception {
        for (int i = 0; i < 10; i++) send(rally, "driver" + i + "@invites.invalid", OWNER).andExpect(status().isAccepted());
        send(rally, "driver0@invites.invalid", OWNER).andExpect(status().isAccepted());
        call(delete("/api/rallies/" + rally).header("X-Crew-Id", crew), OWNER).andExpect(status().isNoContent());
        assertEquals(0, invitations.count());
        send(sibling, "driver10@invites.invalid", OWNER).andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "86400"));
        now.addAndGet(Duration.ofDays(1).toMillis());
        send(sibling, "driver10@invites.invalid", OWNER).andExpect(status().isAccepted());
    }

    @Test
    void competingAcceptAndCancelProduceOneOutcome() throws Exception {
        send(rally, "reader@invites.invalid", OWNER).andExpect(status().isAccepted());
        String id = invitationId(rally);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Future<Integer> accept = executor.submit(() -> { start.await(); return call(post("/api/invitations/" + id + "/accept"), READER).andReturn().getResponse().getStatus(); });
            Future<Integer> cancel = executor.submit(() -> { start.await(); return call(post(cancel(rally, id)), OWNER).andReturn().getResponse().getStatus(); });
            start.countDown();
            int accepted = accept.get(10, TimeUnit.SECONDS), cancelled = cancel.get(10, TimeUnit.SECONDS);
            assertTrue((accepted == 200 && cancelled == 409) || (accepted == 409 && cancelled == 204));
            assertEquals(accepted == 200 ? 1 : 0, grants.count());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void acceptanceChecksCurrentOwnershipAndDoesNotReactivateInactiveGrants() throws Exception {
        send(rally, "reader@invites.invalid", OWNER).andExpect(status().isAccepted());
        String id = invitationId(rally);
        grants.save(new RallyReadGrantEntity(users.findById("reader").get(), rallies.findById(rally).get(), false));
        grants.save(new RallyReadGrantEntity(users.findById("reader").get(), rallies.findById(sibling).get(), true));
        send(sibling, "reader@invites.invalid", OWNER).andExpect(status().isAccepted());
        call(post("/api/invitations/" + invitationId(sibling) + "/accept"), READER).andExpect(status().isOk());
        assertEquals(2, grants.count());
        assertNull(grants.findByRecipientIdAndRallyId("reader", sibling).get().getSourceInvitationId());
        call(post("/api/invitations/" + id + "/accept"), READER).andExpect(status().isConflict());
        assertFalse(grants.findByRecipientIdAndRallyId("reader", rally).get().isActive());
        assertEquals(1, jdbc.update("update crews set owner_account_id = ? where id = ?", "stranger", crew));
        call(post("/api/invitations/" + id + "/accept"), READER).andExpect(status().isNotFound());
        assertEquals("PENDING", invitations.findById(id).get().getState());
    }

    @Test
    void rejectsInvalidAddressesAndUnverifiedSessions() throws Exception {
        send(rally, "não é email", OWNER).andExpect(status().isBadRequest());
        send(rally, "owner@invites.invalid", OWNER).andExpect(status().isBadRequest());
        user("unverified", "unverified@invites.invalid", "token-unverified", false);
        send(rally, "unverified@invites.invalid", OWNER).andExpect(status().isAccepted());
        String id = invitationId(rally);
        call(get("/api/notifications"), "token-unverified").andExpect(status().isUnauthorized());
        call(post("/api/invitations/" + id + "/accept"), "token-unverified").andExpect(status().isUnauthorized());
        assertEquals(0, grants.count());
    }

    private void user(String id, String email, String token, boolean verified) {
        AuthUserEntity user = new AuthUserEntity();
        user.setId(id); user.setEmail(email); user.setToken(token); user.setEmailVerified(verified);
        user.setPasswordHash("unused-fixture"); user.setTokenExpiresAtEpochMillis(now.get() + Duration.ofDays(30).toMillis());
        users.save(user);
    }

    private String createRally(String name) throws Exception {
        return body(call(post("/api/rallies").header("X-Crew-Id", crew).contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("name", name).put("surface", "TERRA").put("year", 2026).put("location", "Fixture").toString()),
                OWNER).andExpect(status().isOk())).path("id").asText();
    }

    private ResultActions send(String rallyId, String email, String token) throws Exception {
        return call(post("/api/rallies/" + rallyId + "/invitations").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", email).toString()), token);
    }

    private String invitationId(String rallyId) throws Exception {
        return body(call(get("/api/rallies/" + rallyId + "/invitations"), OWNER)
                .andExpect(status().isOk())).path("items").path(0).path("id").asText();
    }

    private String cancel(String rallyId, String id) { return "/api/rallies/" + rallyId + "/invitations/" + id + "/cancel"; }
    private ResultActions call(MockHttpServletRequestBuilder request, String token) throws Exception {
        return http.perform(request.header("Authorization", "Bearer " + token));
    }
    private ResultActions publicBody(String url, JsonNode data) throws Exception {
        return http.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(data.toString()));
    }
    private JsonNode body(ResultActions response) throws Exception {
        return json.readTree(response.andReturn().getResponse().getContentAsByteArray());
    }
}
