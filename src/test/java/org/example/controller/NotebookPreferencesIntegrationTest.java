package org.example.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.example.Main;
import org.example.dto.AuthRequestDTO;
import org.example.entity.AuthUserEntity;
import org.example.repository.AuthUserRepository;
import org.example.repository.NotebookPreferencesRepository;
import org.example.service.AuthService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = Main.class, properties = {
    "recce.test-user.enabled=false", "spring.datasource.url=jdbc:h2:mem:notebook;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false", "recce.storage.type=local"
})
@AutoConfigureMockMvc
class NotebookPreferencesIntegrationTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired AuthService auth;
    @Autowired AuthUserRepository users;
    @Autowired NotebookPreferencesRepository preferences;
    String first;
    String second;
    String email;

    @BeforeEach void setup() {
        email = UUID.randomUUID() + "@notebook.invalid";
        first = register(email);
        String other = UUID.randomUUID() + "@notebook.invalid";
        second = register(other);
        AuthUserEntity owner = users.findByEmailIgnoreCase(email).get();
        AuthUserEntity colleague = users.findByEmailIgnoreCase(other).get();
        colleague.setTeamProfileId(owner.getTeamProfileId());
        users.save(colleague);
    }

    String register(String email) {
        AuthRequestDTO request = new AuthRequestDTO(); request.setEmail(email); request.setPassword("fixture-only-password");
        return "Bearer " + auth.register(request).getToken();
    }

    ObjectNode model() throws Exception {
        return (ObjectNode) json.readTree("{\"version\":1,\"page\":{\"format\":\"A4\",\"orientation\":\"portrait\",\"marginMm\":12,\"rowsPerPage\":8,\"fontPt\":24,\"separators\":true},\"rules\":[{\"match\":\"++\",\"display\":\"++\",\"meaning\":\"personal\",\"role\":\"modifier\",\"attach\":\"previous\",\"position\":\"top-right\",\"size\":60,\"bold\":false,\"underline\":true,\"highlight\":false}]}");
    }

    void save(String token, ObjectNode value, int expected) throws Exception {
        http.perform(put("/api/notebook-preferences").header("Authorization", token)
            .contentType(MediaType.APPLICATION_JSON).content(value.toString())).andExpect(status().is(expected));
    }

    @Test void requiresAuthenticationAndSupportsCrossOriginPutPreflight() throws Exception {
        http.perform(get("/api/notebook-preferences")).andExpect(status().isUnauthorized());
        http.perform(put("/api/notebook-preferences").contentType(MediaType.APPLICATION_JSON).content(model().toString()))
            .andExpect(status().isUnauthorized());
        http.perform(options("/api/notebook-preferences").header("Origin", "http://localhost:4200")
            .header("Access-Control-Request-Method", "PUT").header("Access-Control-Request-Headers", "authorization,content-type"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "*"));
    }

    @Test void persistsPerUserEvenWithinTheSameTeamAndRejectsSpoofedOwnership() throws Exception {
        ObjectNode value = model();
        save(first, value, 200);
        http.perform(get("/api/notebook-preferences").header("Authorization", first)).andExpect(status().isOk())
            .andExpect(content().json(value.toString())).andExpect(header().string("Cache-Control", "no-store"));
        String userId = users.findByEmailIgnoreCase(email).get().getId();
        assertEquals(value, json.readTree(preferences.findById(userId).get().getSettings()), "Must persist to JPA, not a controller cache");
        http.perform(get("/api/notebook-preferences").header("Authorization", second)).andExpect(status().isNoContent())
            .andExpect(header().string("Cache-Control", "no-store"));
        ObjectNode other = model(); ((ObjectNode) other.get("page")).put("fontPt", 32);
        save(second, other, 200);
        http.perform(get("/api/notebook-preferences").header("Authorization", first)).andExpect(content().json(value.toString()));
        other.put("userId", userId); save(second, other, 400);
        http.perform(get("/api/notebook-preferences/" + userId).header("Authorization", second)).andExpect(status().isNotFound());
        http.perform(delete("/api/notebook-preferences").header("Authorization", second)).andExpect(status().isMethodNotAllowed());
    }

    @Test void invalidUpdatesDoNotOverwriteSavedSettings() throws Exception {
        ObjectNode original = model(); save(first, original, 200);
        for (String field : new String[]{"rowsPerPage", "fontPt", "marginMm"}) {
            ObjectNode invalid = model(); ((ObjectNode) invalid.get("page")).put(field, 0); save(first, invalid, 400);
            ((ObjectNode) invalid.get("page")).put(field, 12.5); save(first, invalid, 400);
        }
        ObjectNode invalid = model(); invalid.put("version", 2); save(first, invalid, 400);
        invalid = model(); ((ObjectNode) invalid.get("rules").get(0)).put("position", "url(javascript:alert(1))"); save(first, invalid, 400);
        invalid = model(); ((com.fasterxml.jackson.databind.node.ArrayNode) invalid.get("rules")).add(invalid.get("rules").get(0).deepCopy()); save(first, invalid, 400);
        invalid = model(); ((ObjectNode) invalid.get("rules").get(0)).put("size", 1000); save(first, invalid, 400);
        http.perform(get("/api/notebook-preferences").header("Authorization", first)).andExpect(content().json(original.toString()));
    }

    @Test void pageAlignmentIsOptionalBoundedPersistentAndPersonal() throws Exception {
        ObjectNode legacy = model(); save(first, legacy, 200);
        http.perform(get("/api/notebook-preferences").header("Authorization", first))
            .andExpect(content().json(legacy.toString()));
        for (String alignment : new String[]{"left", "center", "right"}) {
            ObjectNode value = model(); ((ObjectNode) value.get("page")).put("alignment", alignment);
            save(first, value, 200);
            http.perform(get("/api/notebook-preferences").header("Authorization", first))
                .andExpect(jsonPath("$.page.alignment").value(alignment));
            String id = users.findByEmailIgnoreCase(email).get().getId();
            assertEquals(alignment, json.readTree(preferences.findById(id).get().getSettings()).path("page").path("alignment").asText());
        }
        for (JsonNodeInvalidAlignment invalidValue : JsonNodeInvalidAlignment.values()) {
            ObjectNode invalid = model();
            ((ObjectNode) invalid.get("page")).set("alignment", json.readTree(invalidValue.json));
            save(first, invalid, 400);
        }
        ObjectNode other = model(); ((ObjectNode) other.get("page")).put("alignment", "left");
        save(second, other, 200);
        http.perform(get("/api/notebook-preferences").header("Authorization", first))
            .andExpect(jsonPath("$.page.alignment").value("right"));
        http.perform(get("/api/notebook-preferences").header("Authorization", second))
            .andExpect(jsonPath("$.page.alignment").value("left"));
    }

    private enum JsonNodeInvalidAlignment {
        NULL("null"), EMPTY("\"\""), UNSUPPORTED("\"justify\""), CSS("\"url(javascript:alert(1))\""), NUMBER("1"), OBJECT("{}");
        final String json;
        JsonNodeInvalidAlignment(String json) { this.json = json; }
    }

    @Test void acceptsEmptyDictionaryAndUnicodeWithoutInterpretingSymbols() throws Exception {
        ObjectNode value = model();
        ((ObjectNode) value.get("rules").get(0)).put("display", "↗ <script>alert(1)</script>");
        save(first, value, 200);
        http.perform(get("/api/notebook-preferences").header("Authorization", first)).andExpect(content().json(value.toString()));
        value.putArray("rules"); save(first, value, 200);
    }

    @Test void dictionaryMeaningRemainsPersonalWithinTheSameTeamAndLegacyUpdatesPreserveIt() throws Exception {
        String body = "{\"phrase\":\"curva minha\",\"symbol\":\"Z6\",\"meaning\":\"significado pessoal\",\"enabled\":true}";
        String created = http.perform(post("/api/note-dictionary-rules").header("Authorization", first)
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String id = json.readTree(created).get("id").asText();
        http.perform(get("/api/note-dictionary-rules").header("Authorization", first)).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].meaning").value("significado pessoal"));
        http.perform(get("/api/note-dictionary-rules").header("Authorization", second)).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
        http.perform(patch("/api/note-dictionary-rules/" + id).header("Authorization", second)
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
        http.perform(patch("/api/note-dictionary-rules/" + id).header("Authorization", first)
            .contentType(MediaType.APPLICATION_JSON).content("{\"phrase\":\"curva minha\",\"symbol\":\"Z7\",\"enabled\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.meaning").value("significado pessoal"));
        com.fasterxml.jackson.databind.node.ObjectNode invalid = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(body);
        invalid.put("meaning", new String(new char[201]).replace('\0', 'x'));
        http.perform(patch("/api/note-dictionary-rules/" + id).header("Authorization", first)
            .contentType(MediaType.APPLICATION_JSON).content(invalid.toString())).andExpect(status().isBadRequest());
        http.perform(get("/api/note-dictionary-rules").header("Authorization", first))
            .andExpect(jsonPath("$[0].symbol").value("Z7")).andExpect(jsonPath("$[0].meaning").value("significado pessoal"));
        http.perform(post("/api/note-dictionary-rules").header("Authorization", first)
            .contentType(MediaType.APPLICATION_JSON).content("{\"phrase\":\"regra antiga\",\"symbol\":\"OLD\",\"enabled\":true}"))
            .andExpect(status().isOk());
    }

    @Test void onlyTheBaseNoteSystemIsSharedAndOtherProfileUpdatesPreserveIt() throws Exception {
        save(first, model(), 200);
        http.perform(patch("/api/team-profile").header("Authorization", first).contentType(MediaType.APPLICATION_JSON)
            .content("{\"noteSystem\":\"Sistema partilhado\"}")).andExpect(status().isOk());
        http.perform(get("/api/team-profile").header("Authorization", second)).andExpect(status().isOk())
            .andExpect(jsonPath("$.noteSystem").value("Sistema partilhado"));
        http.perform(patch("/api/team-profile").header("Authorization", second).contentType(MediaType.APPLICATION_JSON)
            .content("{\"driverName\":\"Updated driver\"}")).andExpect(status().isOk())
            .andExpect(jsonPath("$.noteSystem").value("Sistema partilhado"));
        http.perform(get("/api/notebook-preferences").header("Authorization", second)).andExpect(status().isNoContent());
        String foreign = register(UUID.randomUUID() + "@other-team.invalid");
        String otherProfile = http.perform(get("/api/team-profile").header("Authorization", foreign)).andReturn().getResponse().getContentAsString();
        assertNotEquals("Sistema partilhado", json.readTree(otherProfile).get("noteSystem").asText());
    }
}
