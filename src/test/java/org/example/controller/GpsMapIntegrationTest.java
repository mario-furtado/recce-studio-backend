package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.Main;
import org.example.dto.AuthRequestDTO;
import org.example.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = Main.class, properties = {
    "recce.test-user.enabled=false", "spring.datasource.url=jdbc:h2:mem:gps-map;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false", "recce.storage.type=local",
    "recce.upload-dir=target/gps-map-uploads"
})
@AutoConfigureMockMvc
class GpsMapIntegrationTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired AuthService auth;
    private String token, foreign, pec, rally;

    private String account() {
        AuthRequestDTO request = new AuthRequestDTO();
        request.setEmail(UUID.randomUUID() + "@gps-map.invalid");
        request.setPassword("local-fixture-only");
        return "Bearer " + auth.register(request).getToken();
    }
    @BeforeEach void setup() throws Exception {
        token = account(); foreign = account();
        rally = call(post("/api/rallies"), "{\"name\":\"GPS fixture\",\"year\":2026,\"surface\":\"TERRA\",\"location\":\"Local\"}").get("id").asText();
        pec = call(post("/api/rallies/" + rally + "/pecs"), "{\"number\":1,\"name\":\"GPS fixture\",\"distanceKm\":1}").get("id").asText();
    }
    private JsonNode call(MockHttpServletRequestBuilder request, String body) throws Exception {
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(body);
        return json.readTree(http.perform(request.header("Authorization", token)).andExpect(status().is2xxSuccessful())
                .andReturn().getResponse().getContentAsString());
    }
    private String sync(String id, double latitude) {
        return "{\"sessionId\":\"" + id + "\",\"pecId\":\"" + pec + "\",\"markers\":["
            + "{\"index\":1,\"timestamp\":0.1,\"text\":\"D6 > E3\",\"latitude\":38.7001,\"longitude\":-9.1}],"
            + "\"gpsTrack\":[{\"lat\":" + latitude + ",\"lng\":-9.1,\"timestamp\":0,\"accuracy\":5},"
            + "{\"lat\":38.7001,\"lng\":-9.1,\"timestamp\":0.1,\"accuracy\":4}]}";
    }
    @Test void persistsEverySampleAndNoteCoordinatesAcrossReadsEditsAndReplay() throws Exception {
        String payload = sync(UUID.randomUUID().toString(), 38.7);
        JsonNode first = call(post("/api/offline-recces/sync"), payload);
        JsonNode replay = call(post("/api/offline-recces/sync"), payload);
        assertEquals(first.get("syncId"), replay.get("syncId"));
        assertEquals(first.get("offlineSessionId"), replay.get("offlineSessionId"));
        assertEquals(first.get("notesCount"), replay.get("notesCount"));
        JsonNode track = call(get("/api/pecs/" + pec + "/gps/track"), null);
        assertEquals(2, track.size());
        assertEquals(0.1, track.get(1).get("timestamp").asDouble());
        assertEquals(4, track.get(1).get("accuracy").asDouble());
        JsonNode notes = call(get("/api/pecs/" + pec + "/notes"), null);
        assertEquals(1, notes.size());
        assertEquals(38.7001, notes.get(0).get("latitude").asDouble());
        assertEquals(-9.1, notes.get(0).get("longitude").asDouble());
        call(patch("/api/pecs/" + pec + "/notes/" + notes.get(0).get("id").asLong()),
            "{\"text\":\"D6 edited\",\"originalTimestamp\":3}");
        JsonNode updated = call(get("/api/pecs/" + pec + "/notes"), null).get(0);
        assertEquals(38.7001, updated.get("latitude").asDouble());
        assertEquals("D6 edited", updated.get("text").asText());
    }
    @Test void offsetIsPersistedValidatedAndLockedOnCompletedPecOrRally() throws Exception {
        call(patch("/api/pecs/" + pec), "{\"recceVideoOffsetSeconds\":2.5}");
        assertEquals(2.5, call(get("/api/pecs/" + pec), null).get("recceVideoOffsetSeconds").asDouble());
        assertEquals(2.5, call(get("/api/pecs/" + pec + "/assets"), null).get("recceVideoOffsetSeconds").asDouble());
        call(patch("/api/pecs/" + pec), "{\"recceVideoOffsetSeconds\":-2.5}");
        assertEquals(-2.5, call(get("/api/pecs/" + pec + "/assets"), null).get("recceVideoOffsetSeconds").asDouble());
        call(patch("/api/pecs/" + pec), "{\"recceVideoOffsetSeconds\":2.5}");
        http.perform(patch("/api/pecs/" + pec).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"recceVideoOffsetSeconds\":86401}")).andExpect(status().isBadRequest());
        assertEquals(2.5, call(get("/api/pecs/" + pec), null).get("recceVideoOffsetSeconds").asDouble());
        call(patch("/api/pecs/" + pec), "{\"status\":\"COMPLETED\"}");
        http.perform(patch("/api/pecs/" + pec).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"recceVideoOffsetSeconds\":0}")).andExpect(status().isBadRequest());
        call(patch("/api/pecs/" + pec), "{\"status\":\"DRAFT\"}");
        call(put("/api/rallies/" + rally), "{\"status\":\"COMPLETED\"}");
        http.perform(patch("/api/pecs/" + pec).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"recceVideoOffsetSeconds\":0}")).andExpect(status().isBadRequest());
    }
    @Test void anonymousAndOtherTeamsCannotAccessGpsNotesOrChangeAlignment() throws Exception {
        for (String path : new String[]{"/gps/track", "/gps/markers", "/notes", "/assets"}) {
            http.perform(get("/api/pecs/" + pec + path)).andExpect(status().isUnauthorized());
            http.perform(get("/api/pecs/" + pec + path).header("Authorization", foreign)).andExpect(status().isNotFound());
        }
        http.perform(patch("/api/pecs/" + pec).header("Authorization", foreign).contentType(MediaType.APPLICATION_JSON)
            .content("{\"recceVideoOffsetSeconds\":7}")).andExpect(status().isNotFound());
        http.perform(patch("/api/pecs/" + pec).contentType(MediaType.APPLICATION_JSON)
            .content("{\"recceVideoOffsetSeconds\":7}")).andExpect(status().isUnauthorized());
        assertEquals(0, call(get("/api/pecs/" + pec), null).get("recceVideoOffsetSeconds").asDouble());
    }
    @Test void invalidSamplesFailBeforePersistingAnything() throws Exception {
        http.perform(post("/api/offline-recces/sync").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content(sync(UUID.randomUUID().toString(), 91))).andExpect(status().isBadRequest());
        http.perform(post("/api/offline-recces/sync").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content(sync(UUID.randomUUID().toString(), 38.7).replace("\"lat\":38.7,", "\"lat\":null,")))
            .andExpect(status().isBadRequest());
        assertEquals(0, call(get("/api/pecs/" + pec + "/gps/track"), null).size());
        assertEquals(0, call(get("/api/pecs/" + pec + "/notes"), null).size());
    }
}
