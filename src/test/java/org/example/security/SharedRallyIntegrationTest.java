package org.example.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.example.Main;
import org.example.entity.AuthUserEntity;
import org.example.entity.RallyReadGrantEntity;
import org.example.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = Main.class, properties = {
        "recce.crews.enabled=true", "recce.test-user.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:shared-rally;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false",
        "recce.storage.type=local", "recce.upload-dir=target/shared-rally-test-uploads"
})
@AutoConfigureMockMvc
class SharedRallyIntegrationTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired AuthUserRepository users;
    @Autowired RallyRepository rallies;
    @Autowired RallyReadGrantRepository grants;
    @Autowired BookPublicationRepository books;
    @Autowired NoteRepository notes;
    @Autowired PecRepository pecs;
    @Autowired NotebookPreferencesRepository preferences;

    private String crew, rally, pec, sibling, siblingPec, shared, ownerPec, noteId;

    @Test
    void invitationFlagDefaultsOffWhileExistingReadGrantsStillWork() throws Exception {
        reader(get("/api/invitations/options")).andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));
        reader(get("/api/notifications")).andExpect(status().isForbidden());
        owner(payload(post("/api/rallies/" + rally + "/invitations"), "{\"email\":\"reader@sharing.invalid\"}"))
                .andExpect(status().isForbidden());
        reader(get("/api/shared-rallies/" + rally)).andExpect(status().isOk());
    }

    @BeforeEach
    void seed() throws Exception {
        grants.deleteAll();
        books.deleteAll();
        notes.deleteAll();
        pecs.deleteAll();
        rallies.deleteAll();
        preferences.deleteAll();
        for (String name : Arrays.asList("owner", "reader", "stranger")) {
            AuthUserEntity user = new AuthUserEntity();
            user.setId(name);
            user.setEmail(name + "@sharing.invalid");
            user.setPasswordHash("test-fixture");
            user.setToken("sharing-" + name);
            user.setEmailVerified(true);
            user.setTokenExpiresAtEpochMillis(System.currentTimeMillis() + 600000);
            users.save(user);
        }
        crew = field(call(payload(post("/api/crews"), "{\"name\":\"Sharing crew\"}")
                .header("Idempotency-Key", UUID.randomUUID().toString()), "owner", null).andExpect(status().isOk()), "id");
        rally = rally("Rali concedido");
        sibling = rally("Rali privado da mesma tripulação");
        pec = pec(rally);
        siblingPec = pec(sibling);
        shared = "/api/shared-rallies/" + rally + "/pecs/" + pec;
        ownerPec = "/api/pecs/" + pec;
        noteId = field(owner(payload(post(ownerPec + "/notes"),
                "{\"text\":\"E3\",\"originalTimestamp\":1,\"latitude\":38.7,\"longitude\":-9.1}"))
                .andExpect(status().isOk()), "id");
        grants.save(new RallyReadGrantEntity(users.findById("reader").get(), rallies.findById(rally).get(), true));
        grants.save(new RallyReadGrantEntity(users.findById("reader").get(), rallies.findById(sibling).get(), false));
    }

    @Test
    void readsOnlyTheGrantedCompletedRallyIncludingBoundedMedia() throws Exception {
        byte[] bytes = {1, 2, 3, 4};
        for (String kind : Arrays.asList("audio", "video")) {
            owner(multipart(ownerPec + "/" + kind).file(new MockMultipartFile("file", "fixture.webm", kind + "/webm", bytes)))
                    .andExpect(status().isOk());
        }
        String gpx = "<gpx version='1.1' creator='fixture'><trk><trkseg><trkpt lat='38.7' lon='-9.1'/></trkseg></trk></gpx>";
        owner(multipart(ownerPec + "/gps").file(new MockMultipartFile("file", "fixture.gpx", "application/gpx+xml", gpx.getBytes("UTF-8"))))
                .andExpect(status().isOk());
        owner(payload(put("/api/rallies/" + rally), "{\"status\":\"COMPLETED\"}")).andExpect(status().isOk());
        reader(get("/api/shared-rallies").header("X-Crew-Id", "irrelevant"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(rally))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"));
        reader(get("/api/shared-rallies/" + rally)).andExpect(status().isOk())
                .andExpect(jsonPath("$.pecs[0].id").value(pec)).andExpect(jsonPath("$.teamProfileId").doesNotExist());
        reader(get(shared)).andExpect(status().isOk()).andExpect(jsonPath("$.notes[0].text").value("E3"))
                .andExpect(jsonPath("$.notes[0].presentationJson").doesNotExist()).andExpect(jsonPath("$.videoUrl").doesNotExist());
        reader(get(shared + "/gps/track")).andExpect(status().isOk()).andExpect(jsonPath("$[0].lat").value(38.7));
        for (String kind : Arrays.asList("audio", "video")) {
            reader(get(shared + "/" + kind)).andExpect(status().isOk()).andExpect(content().bytes(bytes));
            reader(head(shared + "/" + kind)).andExpect(status().isOk()).andExpect(header().string("Accept-Ranges", "bytes"));
            http.perform(head(shared + "/" + kind)).andExpect(status().isUnauthorized());
            reader(get(shared + "/" + kind).header("Range", "bytes=1-2")).andExpect(status().isPartialContent())
                    .andExpect(header().string("Content-Range", "bytes 1-2/4")).andExpect(content().bytes(new byte[]{2, 3}));
            reader(get(shared + "/" + kind).header("Range", "bytes=8-9")).andExpect(status().isRequestedRangeNotSatisfiable());
            call(get(shared + "/" + kind).header("Range", "bytes=1-2"), "stranger", crew).andExpect(status().isNotFound());
            http.perform(get(shared + "/" + kind).param("token", "sharing-reader")).andExpect(status().isUnauthorized());
        }
        http.perform(get(shared)).andExpect(status().isUnauthorized());
        reader(get("/api/shared-rallies/" + sibling)).andExpect(status().isNotFound());
        reader(get("/api/shared-rallies/" + rally + "/pecs/" + siblingPec + "/video")).andExpect(status().isNotFound());
        reader(get(shared + "/audio").param("pecId", siblingPec)).andExpect(content().bytes(bytes));
        reader(post("/api/auth/logout")).andExpect(status().isNoContent());
        reader(get(shared + "/audio")).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsReaderMutationsEvenWithForgedOwnerContext() throws Exception {
        for (MockHttpServletRequestBuilder write : Arrays.asList(
                post("/api/rallies"), put("/api/rallies/" + rally), delete("/api/rallies/" + rally),
                post("/api/rallies/" + rally + "/pecs"), patch(ownerPec), delete(ownerPec),
                post(ownerPec + "/notes"), patch(ownerPec + "/notes/" + noteId), delete(ownerPec + "/notes/" + noteId),
                patch(ownerPec + "/notes/" + noteId + "/align"), post(ownerPec + "/notes/apply-offset"),
                post(ownerPec + "/sync-timestamps"), post("/api/offline-recces/sync"),
                put(ownerPec + "/reccebook-cover"), put(ownerPec + "/book-publication"),
                delete(ownerPec + "/audio"), delete(ownerPec + "/video"),
                multipart(ownerPec + "/audio").file(new MockMultipartFile("file", new byte[]{1})),
                multipart(ownerPec + "/video").file(new MockMultipartFile("file", new byte[]{1})),
                multipart(ownerPec + "/gps").file(new MockMultipartFile("file", new byte[]{1})),
                multipart(ownerPec + "/import-excel").file(new MockMultipartFile("file", new byte[]{1})))) {
            call(payload(write, "{\"teamProfileId\":\"" + crew + "\",\"status\":\"COMPLETED\"}"), "reader", crew)
                    .andExpect(status().isNotFound());
        }
        reader(put(shared + "/book-publication")).andExpect(status().isMethodNotAllowed());
        reader(get(ownerPec + "/notes")).andExpect(status().isForbidden());
        call(get("/api/notebook-preferences"), "reader", crew).andExpect(status().isNotFound());
        assertEquals(2, rallies.count());
        assertEquals(2, pecs.count());
        assertEquals("E3", notes.findById(Long.valueOf(noteId)).get().getText());
        assertEquals(0, books.count());
        assertNull(pecs.findById(pec).get().getRecceBookCover());
    }

    @Test
    void publicationIsExplicitVersionedAndIndependentOfLiveNotesAndPrivatePreferences() throws Exception {
        reader(get(shared + "/book-publication")).andExpect(status().isNoContent());
        assertEquals(0, books.count());
        ObjectNode snapshot = snapshot();
        owner(payload(put(ownerPec + "/book-publication"), snapshot.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1));
        ObjectNode settings = json.createObjectNode().put("version", 1);
        settings.set("page", snapshot.path("page"));
        settings.putArray("rules").addObject().put("match", "secret-phrase").put("display", "private-symbol")
                .put("meaning", "private-meaning").put("role", "main").put("attach", "standalone")
                .put("position", "center").put("size", 100).put("bold", true).put("underline", false).put("highlight", false);
        owner(payload(put("/api/notebook-preferences"), settings.toString())).andExpect(status().isOk());
        owner(payload(patch(ownerPec + "/notes/" + noteId), "{\"text\":\"Nota posterior\"}")).andExpect(status().isOk());
        reader(get(shared + "/book-publication")).andExpect(status().isOk())
                .andExpect(jsonPath("$.revision").value(1)).andExpect(jsonPath("$.snapshot.page.fontPt").value(24))
                .andExpect(jsonPath("$.snapshot.notes[0][0].elements[0].display").value("D6"))
                .andExpect(jsonPath("$.snapshot.rules").doesNotExist())
                .andExpect(jsonPath("$.snapshot.notes[0][0].elements[0].meaning").doesNotExist());
        assertEquals(snapshot, json.readTree(books.findById(pec).get().getSnapshot()));
        assertEquals(1, preferences.count());
        assertNull(pecs.findById(pec).get().getRecceBookCover());
        ObjectNode firstElement = (ObjectNode) snapshot.path("notes").path(0).path(0).path("elements").path(0);
        firstElement.put("meaning", "private-meaning");
        owner(payload(put(ownerPec + "/book-publication"), snapshot.toString())).andExpect(status().isBadRequest());
        assertEquals(1, books.findById(pec).get().getRevision());
        firstElement.remove("meaning");
        firstElement.put("display", "E2");
        owner(payload(put(ownerPec + "/book-publication"), snapshot.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(2));
        call(get(shared + "/book-publication"), "stranger", null).andExpect(status().isNotFound());
        owner(delete(ownerPec)).andExpect(status().isNoContent());
        assertFalse(books.existsById(pec));
        reader(get(shared + "/book-publication")).andExpect(status().isNotFound());
    }

    @Test
    void concurrentPublicationsGetDistinctRevisions() throws Exception {
        String first = snapshot().toString();
        String second = first.replace("\"D6\"", "\"E4\"");
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<String> revisionA = executor.submit(() -> publish(first));
            Future<String> revisionB = executor.submit(() -> publish(second));
            String a = revisionA.get(10, TimeUnit.SECONDS);
            String b = revisionB.get(10, TimeUnit.SECONDS);
            assertTrue(("1".equals(a) && "2".equals(b)) || ("2".equals(a) && "1".equals(b)));
            assertEquals("2".equals(a) ? first : second, books.findById(pec).get().getSnapshot());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void unavailableFilesDoNotExposeInternalStoragePaths() throws Exception {
        org.example.entity.PecEntity stage = pecs.findById(pec).get();
        String path = "target/shared-rally-test-uploads/missing-" + UUID.randomUUID() + ".gpx";
        stage.setGpsStoragePath(path);
        stage.setGpsContentType("application/gpx+xml");
        stage.setAudioStoragePath(path);
        pecs.save(stage);
        reader(get(shared + "/gps/track")).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("O traçado GPS está temporariamente indisponível."));
        reader(get(shared + "/audio")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Recurso indisponível."));
    }

    private String publish(String data) throws Exception {
        return field(owner(payload(put(ownerPec + "/book-publication"), data)).andExpect(status().isOk()), "revision");
    }

    private ObjectNode snapshot() throws Exception {
        JsonNode cover = json.readTree(owner(get(ownerPec + "/reccebook-cover")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray()).path("cover");
        ObjectNode result = json.createObjectNode();
        result.putObject("page").put("format", "A4").put("orientation", "portrait").put("marginMm", 12)
                .put("rowsPerPage", 8).put("fontPt", 24).put("separators", true).put("alignment", "center");
        result.set("cover", cover);
        result.putArray("notes").addArray().addObject().put("breakBefore", false).putArray("elements")
                .addObject().put("display", "D6").put("position", "center").put("size", 100)
                .put("bold", true).put("underline", false).put("highlight", false);
        return result;
    }

    private String rally(String name) throws Exception {
        return field(owner(payload(post("/api/rallies"), json.createObjectNode().put("name", name)
                .put("year", 2026).put("surface", "TERRA").put("location", "Fixture").toString()))
                .andExpect(status().isOk()), "id");
    }

    private String pec(String rallyId) throws Exception {
        return field(owner(payload(post("/api/rallies/" + rallyId + "/pecs"), "{\"name\":\"Fixture PEC\",\"number\":1,\"distanceKm\":2}"))
                .andExpect(status().isCreated()), "id");
    }

    private String field(ResultActions response, String name) throws Exception {
        return json.readTree(response.andReturn().getResponse().getContentAsByteArray()).path(name).asText();
    }

    private MockHttpServletRequestBuilder payload(MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private ResultActions owner(MockHttpServletRequestBuilder request) throws Exception { return call(request, "owner", crew); }
    private ResultActions reader(MockHttpServletRequestBuilder request) throws Exception { return call(request, "reader", null); }

    private ResultActions call(MockHttpServletRequestBuilder request, String account, String context) throws Exception {
        request.header("Authorization", "Bearer sharing-" + account);
        if (context != null) request.header("X-Crew-Id", context);
        return http.perform(request);
    }
}
