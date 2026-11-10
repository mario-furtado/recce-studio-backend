package org.example.security;

import org.example.Main;
import org.example.entity.AuthUserEntity;
import org.example.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes=Main.class,properties={"recce.test-user.enabled=false","recce.crews.enabled=false",
    "spring.datasource.url=jdbc:h2:mem:crews-off;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE","spring.jpa.hibernate.ddl-auto=create-drop","spring.jpa.show-sql=false"})
@AutoConfigureMockMvc
class CrewFeatureDisabledIntegrationTest {
    @Autowired MockMvc http; @Autowired AuthUserRepository users; @Autowired CrewRepository crews;
    @Test void disabledRolloutDeniesCreationAndExplicitContextWithoutAffectingPersonalIdentity() throws Exception {
        AuthUserEntity u=new AuthUserEntity();u.setId("personal");u.setEmail("personal@crew.invalid");u.setEmailVerified(true);u.setPasswordHash("unused");u.setToken("off-token");u.setTokenExpiresAtEpochMillis(System.currentTimeMillis()+60000);users.save(u);
        http.perform(get("/api/auth/me").header("Authorization","Bearer off-token")).andExpect(status().isOk()).andExpect(jsonPath("$.crewsEnabled").value(false));
        http.perform(post("/api/crews").header("Authorization","Bearer off-token").header("Idempotency-Key","fixed-request-key").contentType("application/json").content("{\"name\":\"Closed\"}")).andExpect(status().isForbidden());
        http.perform(get("/api/crews").header("Authorization","Bearer off-token")).andExpect(status().isForbidden());
        http.perform(get("/api/rallies").header("Authorization","Bearer off-token").header("X-Crew-Id","forged")).andExpect(status().isForbidden());
        assertEquals(0,crews.count());
    }
}
