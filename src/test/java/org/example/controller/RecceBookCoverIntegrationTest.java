package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.example.Main;
import org.example.dto.AuthRequestDTO;
import org.example.entity.AuthUserEntity;
import org.example.repository.AuthUserRepository;
import org.example.repository.PecRepository;
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

@SpringBootTest(classes = Main.class, properties = {"recce.test-user.enabled=false", "spring.datasource.url=jdbc:h2:mem:covers;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE", "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false", "recce.storage.type=local"})
@AutoConfigureMockMvc
class RecceBookCoverIntegrationTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired AuthService auth;
    @Autowired AuthUserRepository users;
    @Autowired PecRepository pecs;
    @Autowired org.example.repository.RecceBookTemplateRepository templates;
    String owner, colleague, outsider, rallyId, pecId;
    @BeforeEach void setup() throws Exception {
        String email = UUID.randomUUID() + "@cover.invalid", peer = UUID.randomUUID() + "@cover.invalid";
        owner = register(email); colleague = register(peer); outsider = register(UUID.randomUUID() + "@cover.invalid");
        AuthUserEntity user = users.findByEmailIgnoreCase(peer).get(); user.setTeamProfileId(users.findByEmailIgnoreCase(email).get().getTeamProfileId()); users.save(user);
        rallyId = json.readTree(http.perform(post("/api/rallies").header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Serra real\",\"year\":2026,\"surface\":\"TERRA\",\"location\":\"Serra\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("id").asText();
        pecId = newPec("Penhas reais");
    }
    String register(String email) { AuthRequestDTO req = new AuthRequestDTO(); req.setEmail(email); req.setPassword("fixture-only-password"); return "Bearer " + auth.register(req).getToken(); }
    String newPec(String name) throws Exception {
        return json.readTree(http.perform(post("/api/rallies/" + rallyId + "/pecs").header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"" + name + "\",\"number\":1,\"distanceKm\":8.5}")).andExpect(status().isCreated()).andReturn().getResponse().getContentAsByteArray()).path("id").asText();
    }
    String endpoint() { return "/api/pecs/" + pecId + "/reccebook-cover"; }
    ObjectNode current() throws Exception {
        return (ObjectNode) json.readTree(http.perform(get(endpoint()).header("Authorization", owner)).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse().getContentAsByteArray()).path("cover");
    }
    void save(String token, JsonNode value, int expected) throws Exception { http.perform(put(endpoint()).header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content(value.toString())).andExpect(status().is(expected)); }
    @Test void legacyDefaultsUseActualPecAndRallyWithoutWriting() throws Exception {
        ObjectNode model = current(); assertTrue(model.toString().contains("Serra real")); assertTrue(model.toString().contains("Penhas reais"));
        assertNull(pecs.findById(pecId).get().getRecceBookCover()); assertEquals(0, model.path("back").path("elements").size());
    }
    ObjectNode template(String token) throws Exception {
        return (ObjectNode) json.readTree(http.perform(get("/api/reccebook-template").header("Authorization", token))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andReturn().getResponse().getContentAsByteArray()).path("cover");
    }
    void saveTemplate(String token, JsonNode value, int expected) throws Exception {
        http.perform(put("/api/reccebook-template").header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content(value.toString())).andExpect(status().is(expected));
    }
    @Test void mainTemplateIsPersonalAndRejectsInvalidOrSpoofedWrites() throws Exception {
        long initialCount = templates.count(); ObjectNode initial = template(owner);
        assertTrue(initial.toString().contains("{{rali}}")); assertEquals(initialCount, templates.count());
        http.perform(get("/api/reccebook-template")).andExpect(status().isUnauthorized());
        http.perform(put("/api/reccebook-template").contentType(MediaType.APPLICATION_JSON).content(initial.toString())).andExpect(status().isUnauthorized());
        ObjectNode own = initial.deepCopy(); ((ObjectNode) own.path("front").path("elements").get(0)).put("text", "Pessoal {{rali}}");
        saveTemplate(owner, own, 200); assertEquals(own, template(owner));
        assertEquals(initial, template(colleague)); assertEquals(initial, template(outsider));
        ObjectNode peer = initial.deepCopy(); ((ObjectNode) peer.path("front").path("elements").get(0)).put("text", "Colega");
        saveTemplate(colleague, peer, 200); assertEquals(own, template(owner));
        ObjectNode bad = own.deepCopy(); bad.put("userId", "another-user"); saveTemplate(owner, bad, 400);
        bad = own.deepCopy(); bad.put("logo", "removed"); saveTemplate(owner, bad, 400);
        bad = own.deepCopy(); ((ObjectNode) bad.path("front").path("elements").get(0)).put("fontPt", 500); saveTemplate(owner, bad, 400);
        assertEquals(own, template(owner));
        http.perform(put("/api/notebook-preferences").header("Authorization", owner).contentType(MediaType.APPLICATION_JSON)
            .content("{\"version\":1,\"page\":{\"format\":\"A4\",\"orientation\":\"portrait\",\"marginMm\":12,\"rowsPerPage\":8,\"fontPt\":24,\"separators\":true},\"rules\":[]}"))
            .andExpect(status().isOk());
        assertEquals(own, template(owner));
    }
    @Test void unsavedPecInheritsPersonalTemplateAndSavedPecRemainsIndependent() throws Exception {
        ObjectNode main = template(owner);
        ((ObjectNode) main.path("front").path("elements").get(0)).put("text", "Livro {{rali}} / {{pec}} / {{equipa}} / {{carro}} / {{data}}");
        saveTemplate(owner, main, 200); ObjectNode inherited = current();
        assertTrue(inherited.toString().contains("Livro Serra real / PEC 1 — Penhas reais"));
        assertFalse(inherited.toString().contains("{{")); assertNull(pecs.findById(pecId).get().getRecceBookCover());
        http.perform(get(endpoint()).header("Authorization", colleague)).andExpect(status().isOk())
            .andExpect(jsonPath("$.cover.front.elements[0].text").value("Serra real"));
        save(owner, inherited, 200);
        ((ObjectNode) main.path("front").path("elements").get(0)).put("text", "Modelo seguinte {{rali}}"); saveTemplate(owner, main, 200);
        assertEquals(inherited, current());
        ((ObjectNode) inherited.path("front").path("elements").get(0)).put("text", "Só esta PEC"); save(owner, inherited, 200);
        assertEquals(main, template(owner));
        pecId = newPec("Nova"); assertTrue(current().toString().contains("Modelo seguinte Serra real"));
    }
    @Test void persistsPerPecAndSharesOnlyWithinTeam() throws Exception {
        ObjectNode model = current(); ((ObjectNode) model.path("front").path("elements").get(0)).put("text", "Capa personalizada <script>literal</script>");
        save(colleague, model, 200); assertEquals(model, current());
        String original = pecId; pecId = newPec("Outra PEC"); assertFalse(current().toString().contains("personalizada")); pecId = original;
        assertEquals(model.toString(), pecs.findById(pecId).get().getRecceBookCover());
    }
    @Test void deniesAnonymousAndForeignAccessWithoutDisclosureOrMutation() throws Exception {
        ObjectNode model = current(); save(owner, model, 200);
        http.perform(get(endpoint())).andExpect(status().isUnauthorized());
        http.perform(get(endpoint()).header("Authorization", outsider)).andExpect(status().isNotFound()); save(outsider, model, 404);
        assertEquals(model, current());
    }
    @Test void rejectsUnknownBrandingCssMalformedBoundsAndLeavesValidDataUntouched() throws Exception {
        ObjectNode model = current(); save(owner, model, 200);
        for (String field : new String[]{"logo", "brand", "html", "position"}) { ObjectNode bad = model.deepCopy(); bad.put(field, "tampered"); save(owner, bad, 400); }
        for (String field : new String[]{"x", "y", "width", "fontPt"}) { ObjectNode bad = model.deepCopy(); ((ObjectNode) bad.path("front").path("elements").get(0)).put(field, 1000); save(owner, bad, 400); }
        ObjectNode bad = model.deepCopy(); ((ObjectNode) bad.path("front").path("elements").get(0)).put("font", "url(javascript:alert(1))"); save(owner, bad, 400);
        bad = model.deepCopy(); ((ObjectNode) bad.path("front").path("elements").get(0)).put("bold", "true"); save(owner, bad, 400);
        bad = model.deepCopy(); ((ObjectNode) bad.path("front")).put("background", "white;display:none"); save(owner, bad, 400);
        bad = model.deepCopy(); bad.put("version", 2); save(owner, bad, 400);
        bad = model.deepCopy(); bad.set("front", json.nullNode()); save(owner, bad, 400);
        bad = model.deepCopy(); bad.put("version", 4294967297L); save(owner, bad, 400);
        bad = model.deepCopy(); ((ObjectNode) bad.path("front").path("elements").get(0)).put("text", new String(new char[1001]).replace('\0', 'x')); save(owner, bad, 400);
        bad = model.deepCopy(); com.fasterxml.jackson.databind.node.ArrayNode entries = (com.fasterxml.jackson.databind.node.ArrayNode) bad.path("front").path("elements");
        while (entries.size() <= 12) entries.add(entries.get(0).deepCopy()); save(owner, bad, 400);
        assertEquals(model, current());
    }
    @Test void completedPecAndRallyAreReadonlyButReadable() throws Exception {
        ObjectNode model = current(); save(owner, model, 200);
        http.perform(patch("/api/pecs/" + pecId).header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\"}")).andExpect(status().isOk());
        http.perform(get(endpoint()).header("Authorization", owner)).andExpect(jsonPath("$.editable").value(false)); save(owner, model, 400);
        http.perform(patch("/api/pecs/" + pecId).header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"DRAFT\"}")).andExpect(status().isOk());
        http.perform(put("/api/rallies/" + rallyId).header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\"}")).andExpect(status().isOk());
        http.perform(get(endpoint()).header("Authorization", owner)).andExpect(jsonPath("$.editable").value(false)); save(owner, model, 400); assertEquals(model, current());
    }
}
