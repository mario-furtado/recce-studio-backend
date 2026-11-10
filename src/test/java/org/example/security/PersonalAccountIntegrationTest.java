package org.example.security;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.example.Main;
import org.example.entity.*;
import org.example.repository.*;
import org.example.service.*;
import org.example.dto.AuthRequestDTO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.test.web.servlet.*;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = Main.class, properties = {
    "recce.test-user.enabled=false", "recce.account.enabled=true",
    "spring.datasource.url=jdbc:h2:mem:personal-accounts;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false", "recce.storage.type=local"
})
@AutoConfigureMockMvc
class PersonalAccountIntegrationTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired AuthService auth;
    @Autowired AuthUserRepository users;
    @Autowired TeamProfileRepository teams;
    @Autowired TeamCarRepository cars;
    @Autowired AccountChallengeRepository challenges;
    @Autowired AccountRateLimitRepository limits;
    @MockBean AccountMailer mail;
    @MockBean Clock clock;
    AtomicLong now = new AtomicLong();
    List<String[]> inbox = new CopyOnWriteArrayList<>();
    final String password = "personal-password-2026";
    @BeforeEach void setup() {
        users.deleteAll(); challenges.deleteAll(); limits.deleteByIdNot(AccountRateLimiter.GUARD);
        inbox.clear(); now.set(1800000000000L); when(clock.millis()).thenAnswer(i -> now.get()); when(mail.isConfigured()).thenReturn(true);
        doAnswer(i -> { inbox.add(new String[]{i.getArgument(0), i.getArgument(1), i.getArgument(2)}); return null; }).when(mail).send(anyString(), anyString(), anyString());
    }
    ObjectNode body(String... values) {
        ObjectNode value = json.createObjectNode(); for (int i=0; i<values.length; i+=2) value.put(values[i], values[i+1]); return value;
    }
    ResultActions postBody(String path, ObjectNode value, String ip) throws Exception {
        return http.perform(post("/api/auth/"+path).with(r -> {r.setRemoteAddr(ip); return r;}).contentType(MediaType.APPLICATION_JSON).content(value.toString()));
    }
    String request(String path, String email) throws Exception {
        postBody(path,body("email",email),"192.0.2.10").andExpect(status().isAccepted()).andExpect(header().string("Cache-Control","no-store"));
        return inbox.get(inbox.size()-1)[2];
    }
    ResultActions confirm(String path,String token,String pass) throws Exception { return postBody(path,body("token",token,"password",pass),"192.0.2.11"); }
    String signup(String email) throws Exception { String token=request("register",email); confirm("verify-email",token,password).andExpect(status().isNoContent()); return login(email,password); }
    String login(String email,String pass) throws Exception {
        return json.readTree(postBody("login",body("email",email,"password",pass),"192.0.2.12").andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("token").asText();
    }
    @Test void verifiesWithoutCreatingTeamAndPersonalIdentityDoesNotGrantLegacyAccess() throws Exception {
        long teamCount=teams.count(), carCount=cars.count();
        String proof=request("register","  New@Example.invalid  "); assertEquals(0,users.count());
        postBody("login",body("email","new@example.invalid","password",password),"192.0.2.12").andExpect(status().isBadRequest());
        AccountChallengeEntity saved=challenges.findById(AccountPasswords.digest(proof)).get(); assertNotEquals(proof,saved.tokenHash); assertEquals(now.get()+86400000L,saved.expiresAt);
        confirm("verify-email",proof,password).andExpect(status().isNoContent());
        String token=login("new@example.invalid",password); AuthUserEntity user=users.findByEmailIgnoreCase("new@example.invalid").get();
        assertNull(user.getTeamProfileId()); assertTrue(user.getEmailVerified()); assertEquals(teamCount,teams.count()); assertEquals(carCount,cars.count());
        assertEquals(now.get()+28800000L,user.getTokenExpiresAtEpochMillis().longValue());
        http.perform(get("/api/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(user.getId())).andExpect(jsonPath("$.hasWorkspace").value(false)).andExpect(jsonPath("$.passwordHash").doesNotExist()).andExpect(jsonPath("$.token").doesNotExist());
        http.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        http.perform(get("/api/auth/validate").header("Authorization","Bearer "+token)).andExpect(status().isOk());
        for(String path:new String[]{"/api/rallies","/api/team-profile","/api/pecs/foreign/video","/api/pecs/foreign/audio","/api/pecs/foreign/reccebook-cover"}) http.perform(get(path).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        http.perform(post("/api/rallies").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"spoof\",\"teamProfileId\":\"default\"}")).andExpect(status().isForbidden());
    }
    @Test void proofsArePurposeBoundExpiringAndSingleUse() throws Exception {
        String proof=request("register","proof@example.invalid");
        confirm("password-reset/confirm",proof,password).andExpect(status().isBadRequest());
        now.addAndGet(86400000L); confirm("verify-email",proof,password).andExpect(status().isBadRequest()); assertEquals(0,users.count());
        String valid=request("verification/request","proof@example.invalid"); confirm("verify-email",valid,password).andExpect(status().isNoContent());
        confirm("verify-email",valid,"changed-password-2026").andExpect(status().isBadRequest()); assertTrue(AccountPasswords.matches(password,users.findAll().get(0).getPasswordHash()));
        confirm("verify-email","not-a-proof",password).andExpect(status().isBadRequest());
    }
    @Test void recoveryRevokesSessionAndOlderResetProofsWithoutChangingIdentityOrTeam() throws Exception {
        String old=signup("reset@example.invalid"); AuthUserEntity before=users.findByEmailIgnoreCase("reset@example.invalid").get();
        String first=request("password-reset/request",before.getEmail()), second=request("password-reset/request",before.getEmail());
        assertEquals(now.get()+1800000L,challenges.findById(AccountPasswords.digest(first)).get().expiresAt);
        confirm("password-reset/confirm",first,"replacement-password-2026").andExpect(status().isNoContent());
        http.perform(get("/api/auth/validate").header("Authorization","Bearer "+old)).andExpect(status().isUnauthorized());
        confirm("password-reset/confirm",first,password).andExpect(status().isBadRequest()); confirm("password-reset/confirm",second,password).andExpect(status().isBadRequest());
        AuthUserEntity after=users.findById(before.getId()).get(); assertEquals(before.getTeamProfileId(),after.getTeamProfileId()); assertTrue(AccountPasswords.matches("replacement-password-2026",after.getPasswordHash())); assertFalse(AccountPasswords.matches(password,after.getPasswordHash()));
        login(before.getEmail(),"replacement-password-2026");
    }
    @Test void publicRequestsDoNotEnumerateOrOverwriteExistingInactiveOrMissingAccounts() throws Exception {
        signup("existing@example.invalid"); AuthUserEntity existing=users.findByEmailIgnoreCase("existing@example.invalid").get(); String hash=existing.getPasswordHash();
        String a=postBody("register",body("email",existing.getEmail()),"192.0.2.20").andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        String sent=inbox.get(inbox.size()-1)[2]; confirm("verify-email",sent,"attacker-password-2026").andExpect(status().isBadRequest());
        String b=postBody("register",body("email","missing@example.invalid"),"192.0.2.20").andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString(); assertEquals(a,b); assertFalse(a.contains(sent));
        existing.setActive(false); users.save(existing);
        String c=postBody("password-reset/request",body("email",existing.getEmail()),"192.0.2.21").andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        String inactiveProof=inbox.get(inbox.size()-1)[2];
        String d=postBody("password-reset/request",body("email","absent@example.invalid"),"192.0.2.21").andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString(); assertEquals(c,d);
        confirm("password-reset/confirm",inactiveProof,password).andExpect(status().isBadRequest()); assertEquals(hash,users.findById(existing.getId()).get().getPasswordHash());
    }
    @Test void rateLimitUsesSlidingEmailAndSocketIpWindowsAndIgnoresForwardedSpoofing() throws Exception {
        for(int i=0;i<5;i++) postBody("register",body("email","limit@example.invalid"),"192.0.2."+(30+i)).andExpect(status().isAccepted());
        postBody("register",body("email","LIMIT@example.invalid"),"192.0.2.40").andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After","900"));
        now.addAndGet(900000L); postBody("register",body("email","limit@example.invalid"),"192.0.2.40").andExpect(status().isAccepted());
        limits.deleteByIdNot(AccountRateLimiter.GUARD);
        for(int i=0;i<5;i++) postBody("password-reset/request",body("email","limit"+i+"@example.invalid"),"192.0.2.50").andExpect(status().isAccepted());
        http.perform(post("/api/auth/password-reset/request").with(r->{r.setRemoteAddr("192.0.2.50");return r;}).header("X-Forwarded-For","198.51.100.99").contentType(MediaType.APPLICATION_JSON).content(body("email","new-limit@example.invalid").toString())).andExpect(status().isTooManyRequests());
    }
    @Test void invalidBodyAndPasswordBoundsDoNotConsumeProofOrCreateUsers() throws Exception {
        postBody("register",body("email","bad\r\n@example.invalid"),"192.0.2.60").andExpect(status().isBadRequest());
        for(String address:new String[]{"Name <person@example.invalid>","one,two@example.invalid","person@example.invalid,other@example.invalid"}) postBody("register",body("email",address),"192.0.2.60").andExpect(status().isBadRequest());
        postBody("register",body("email","good@example.invalid","teamProfileId","default"),"192.0.2.60").andExpect(status().isBadRequest());
        String proof=request("register","bounds@example.invalid");
        confirm("verify-email",proof,"short").andExpect(status().isBadRequest()); assertFalse(challenges.findById(AccountPasswords.digest(proof)).get().used);
        String longPass=String.join("",Collections.nCopies(129,"a")); confirm("verify-email",proof,longPass).andExpect(status().isBadRequest());
        String valid=String.join("",Collections.nCopies(127,"a"))+"X"; confirm("verify-email",proof,valid).andExpect(status().isNoContent());
        AuthUserEntity user=users.findByEmailIgnoreCase("bounds@example.invalid").get(); assertTrue(AccountPasswords.matches(valid,user.getPasswordHash())); assertFalse(AccountPasswords.matches(valid.substring(0,127)+"Y",user.getPasswordHash()));
        String unicode=String.join("",Collections.nCopies(128,"é")); assertTrue(AccountPasswords.matches(unicode,AccountPasswords.encode(unicode)));
        String spaced="a           "; String spacedProof=request("register","spaces@example.invalid");
        confirm("verify-email",spacedProof,spaced).andExpect(status().isNoContent()); login("spaces@example.invalid",spaced);
    }
    @Test void deliveryFailureAndMissingConfigurationNeverExposeOrKeepUsableUndeliveredProofs() throws Exception {
        when(mail.isConfigured()).thenReturn(false);
        http.perform(get("/api/auth/account-options")).andExpect(jsonPath("$.available").value(false));
        postBody("register",body("email","none@example.invalid"),"192.0.2.70").andExpect(status().isServiceUnavailable()); verify(mail,never()).send(anyString(),anyString(),anyString());
        when(mail.isConfigured()).thenReturn(true); doThrow(new MailSendException("provider detail must not escape")).when(mail).send(anyString(),anyString(),anyString());
        String response=postBody("register",body("email","failure@example.invalid"),"192.0.2.70").andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        assertFalse(response.contains("provider")); assertEquals(0,challenges.count()); assertEquals(0,users.count());
    }
    @Test void competingProofUseCreatesOnlyOneAccount() throws Exception {
        String proof=request("register","race@example.invalid"); ExecutorService pool=Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> call=()->confirm("verify-email",proof,password).andReturn().getResponse().getStatus();
            List<Future<Integer>> futures=pool.invokeAll(Arrays.asList(call,call)); List<Integer> results=Arrays.asList(futures.get(0).get(),futures.get(1).get());
            assertTrue(results.contains(204)); assertTrue(results.contains(400)); assertEquals(1,users.count());
        } finally { pool.shutdownNow(); }
    }
    @Test void loginQuotaRecoversAfterItsWindowWithoutChangingCredentials() throws Exception {
        signup("login-limit@example.invalid"); limits.deleteByIdNot(AccountRateLimiter.GUARD);
        for(int i=0;i<5;i++) postBody("login",body("email","login-limit@example.invalid","password","wrong-password"),"192.0.2.90").andExpect(status().isBadRequest());
        postBody("login",body("email","login-limit@example.invalid","password",password),"192.0.2.91").andExpect(status().isTooManyRequests());
        now.addAndGet(900000L); login("login-limit@example.invalid",password);
    }
    @Test void competingRecoveryProofsChangeCredentialsOnlyOnceAndRevokeTheOldSession() throws Exception {
        String old=signup("reset-race@example.invalid");
        String first=request("password-reset/request","reset-race@example.invalid"), second=request("password-reset/request","reset-race@example.invalid");
        ExecutorService pool=Executors.newFixedThreadPool(2);
        try {
            List<Callable<Integer>> calls=Arrays.asList(
                ()->confirm("password-reset/confirm",first,"replacement-password-A").andReturn().getResponse().getStatus(),
                ()->confirm("password-reset/confirm",second,"replacement-password-B").andReturn().getResponse().getStatus());
            List<Future<Integer>> futures=pool.invokeAll(calls);
            List<Integer> results=Arrays.asList(futures.get(0).get(),futures.get(1).get());
            assertTrue(results.contains(204)); assertTrue(results.contains(400));
            String winner=results.get(0)==204 ? "replacement-password-A" : "replacement-password-B";
            login("reset-race@example.invalid",winner);
            http.perform(get("/api/auth/validate").header("Authorization","Bearer "+old)).andExpect(status().isUnauthorized());
            assertEquals(2L,users.findByEmailIgnoreCase("reset-race@example.invalid").get().getCredentialVersion().longValue());
        } finally { pool.shutdownNow(); }
    }
    @Test void cleanupRemovesOnlyExpiredProofsAndWindowsAndExplicitlyUnverifiedUsersCannotAuthenticate() throws Exception {
        String old=request("register","expired@example.invalid"); now.addAndGet(86400000L);
        String fresh=request("register","fresh@example.invalid"); assertFalse(challenges.existsById(AccountPasswords.digest(old))); assertTrue(challenges.existsById(AccountPasswords.digest(fresh)));
        signup("unverified@example.invalid"); AuthUserEntity user=users.findByEmailIgnoreCase("unverified@example.invalid").get(); String token=user.getToken();
        user.setEmailVerified(false); users.save(user);
        http.perform(get("/api/auth/validate").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        http.perform(get("/api/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        postBody("login",body("email",user.getEmail(),"password",password),"192.0.2.12").andExpect(status().isBadRequest());
    }
    @Test void legacyCredentialsStayUsableAndResetPreservesTheirWorkspace() throws Exception {
        AuthRequestDTO request=new AuthRequestDTO(); request.setEmail("legacy@example.invalid"); request.setPassword("oldpass"); auth.register(request);
        AuthUserEntity before=users.findByEmailIgnoreCase(request.getEmail()).get(); String old=login(request.getEmail(),"oldpass");
        String proof=request("password-reset/request",request.getEmail()); confirm("password-reset/confirm",proof,password).andExpect(status().isNoContent());
        AuthUserEntity after=users.findById(before.getId()).get(); assertEquals(before.getTeamProfileId(),after.getTeamProfileId()); assertNull(after.getEmailVerified());
        http.perform(get("/api/auth/validate").header("Authorization","Bearer "+old)).andExpect(status().isUnauthorized());
        String token=login(request.getEmail(),password); http.perform(get("/api/team-profile").header("Authorization","Bearer "+token)).andExpect(status().isOk());
    }
    @Test void unknownResetProofCannotBecomeValidWhenAccountIsLaterCreatedAndResetExpiresAtBoundary() throws Exception {
        String unknown=request("password-reset/request","later@example.invalid"); signup("later@example.invalid");
        confirm("password-reset/confirm",unknown,password).andExpect(status().isBadRequest());
        String real=request("password-reset/request","later@example.invalid"); now.addAndGet(1800000L);
        confirm("password-reset/confirm",real,"replacement-password-2026").andExpect(status().isBadRequest()); assertTrue(AccountPasswords.matches(password,users.findAll().get(0).getPasswordHash()));
    }
}
