package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.example.Main;
import org.example.dto.AuthRequestDTO;
import org.example.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = Main.class, properties = {
        "recce.test-user.enabled=false", "spring.datasource.url=jdbc:h2:mem:note-workflow;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false",
        "recce.storage.type=local", "recce.upload-dir=target/note-workflow-uploads"
})
@AutoConfigureMockMvc
class NoteWorkflowIntegrationTest {
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired AuthService auth;
    private String token;
    private String pec;

    @BeforeEach
    void setUp() throws Exception {
        AuthRequestDTO account = new AuthRequestDTO();
        account.setEmail(UUID.randomUUID() + "@note-workflow.invalid");
        account.setPassword("local-fixture-only");
        token = "Bearer " + auth.register(account).getToken();
        JsonNode rally = call(post("/api/rallies"), "{\"name\":\"Notes fixture\",\"year\":2026,"
                + "\"surface\":\"TERRA\",\"location\":\"Fixture\",\"status\":\"DRAFT\"}");
        pec = call(post("/api/rallies/" + rally.get("id").asText() + "/pecs"),
                "{\"name\":\"Notes fixture\",\"number\":1,\"distanceKm\":1}").get("id").asText();
    }

    @Test
    void occurrencePresentationSurvivesReloadAndAlignmentWithoutAffectingOtherNotes() throws Exception {
        String presentation = "{\"version\":1,\"text\":\"E3 ATT ATT\",\"elements\":[{\"match\":\"ATT\",\"occurrence\":1,\"position\":\"top-right\",\"size\":150,\"bold\":true,\"underline\":true,\"highlight\":true}]}";
        String payload = json.createObjectNode().put("text", "E3 ATT ATT").put("originalTimestamp", 5)
                .put("latitude", 40.1).put("longitude", -8.1).put("presentationJson", presentation).toString();
        JsonNode saved = call(post("/api/pecs/" + pec + "/notes"), payload);
        assertEquals(presentation, saved.path("presentationJson").asText());
        note("E3 ATT ATT", "", 9.0);
        call(patch("/api/pecs/" + pec + "/notes/" + saved.get("id").asLong() + "/align"),
                "{\"targetTimestamp\":6,\"text\":\"E3 ATT ATT\",\"speedRating\":\"atenção local\",\"shiftFollowing\":false}");
        JsonNode reloaded = notes();
        assertEquals(presentation, reloaded.get(0).path("presentationJson").asText());
        assertEquals(40.1, reloaded.get(0).path("latitude").asDouble());
        assertEquals(-8.1, reloaded.get(0).path("longitude").asDouble());
        assertEquals(6, reloaded.get(0).path("originalTimestamp").asDouble());
        assertTrue(reloaded.get(1).path("presentationJson").isNull());
        call(patch("/api/pecs/" + pec + "/notes/" + saved.get("id").asLong() + "/align"),
                "{\"targetTimestamp\":6,\"text\":\"E3 ATT ATT\",\"presentationJson\":null,\"shiftFollowing\":false}");
        assertTrue(notes().get(0).path("presentationJson").isNull());
    }

    @Test
    void invalidPresentationFailsAtomicallyAndLegacyTextEditsClearStaleStyles() throws Exception {
        JsonNode saved = note("E3", "", 5.0);
        note("Following", "", 9.0);
        JsonNode before = notes();
        String valid = "{\"version\":1,\"text\":\"E3\",\"elements\":[{\"match\":\"E3\",\"occurrence\":0,\"position\":\"center\",\"size\":100,\"bold\":true,\"underline\":false,\"highlight\":false}]}";
        for (String invalid : new String[]{"{", valid + " {}", valid.replace("100", "151"), valid.replace("center", "url(evil)"),
                valid.replace("\"text\":\"E3\"", "\"text\":\"D3\""), valid.replace("\"bold\":true", "\"bold\":\"true\""),
                valid.replace("\"occurrence\":0", "\"occurrence\":-1"), valid.replace("\"version\":1", "\"version\":2"),
                valid.replace("\"size\":100", "\"size\":100.5"), valid.replace("\"version\":1", "\"css\":\"color:red\",\"version\":1"),
                new String(new char[30001]).replace('\0', 'x')}) {
            String body = json.createObjectNode().put("text", "E3").put("targetTimestamp", 99)
                    .put("shiftFollowing", true).put("presentationJson", invalid).toString();
            http.perform(patch("/api/pecs/{pec}/notes/{note}/align", pec, saved.get("id").asLong())
                            .header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
            assertEquals(before, notes(), "Invalid style must not change text, times or following notes");
        }
        call(patch("/api/pecs/" + pec + "/notes/" + saved.get("id").asLong()),
                json.createObjectNode().put("text", "E3").put("presentationJson", valid).put("originalTimestamp", 5).toString());
        assertEquals(valid, notes().get(0).path("presentationJson").asText());
        call(patch("/api/pecs/" + pec + "/notes/" + saved.get("id").asLong() + "/align"),
                "{\"text\":\"D3\",\"targetTimestamp\":5,\"shiftFollowing\":false}");
        assertTrue(notes().get(0).path("presentationJson").isNull());
    }

    @Test
    void foreignAccountAndCompletedPecCannotWritePresentation() throws Exception {
        JsonNode saved = note("Private", "", 5.0);
        JsonNode before = notes();
        AuthRequestDTO account = new AuthRequestDTO();
        account.setEmail(UUID.randomUUID() + "@other.invalid"); account.setPassword("fixture-only");
        String foreign = "Bearer " + auth.register(account).getToken();
        http.perform(get("/api/pecs/{id}/notes", pec).header("Authorization", foreign)).andExpect(status().isNotFound());
        String body = "{\"text\":\"Spoofed\",\"targetTimestamp\":99,\"presentationJson\":null}";
        http.perform(patch("/api/pecs/{pec}/notes/{note}/align", pec, saved.get("id").asLong())
                .header("Authorization", foreign).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
        http.perform(patch("/api/pecs/{pec}/notes/{note}", pec, saved.get("id").asLong())
                .header("Authorization", foreign).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
        assertEquals(before, notes());
        call(patch("/api/pecs/" + pec), "{\"status\":\"COMPLETED\"}");
        http.perform(patch("/api/pecs/{pec}/notes/{note}/align", pec, saved.get("id").asLong())
                .header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        assertEquals(before, notes());
    }

    @Test
    void exportedWorkbookCanBeEditedAndReimportedWithoutDuplicatingNotesOrLosingTimes() throws Exception {
        note("D3", "gravilha", 1.5);
        note("E4", "abre", 3.5);
        byte[] workbook = http.perform(get("/api/pecs/{id}/download-template", pec).header("Authorization", token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        byte[] edited;
        try (XSSFWorkbook book = new XSSFWorkbook(new ByteArrayInputStream(workbook));
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Row target = null;
            for (Row row : book.getSheetAt(0)) {
                if (row.getCell(1) != null && row.getCell(1).getCellType() == CellType.STRING
                        && "D3".equals(row.getCell(1).getStringCellValue())) target = row;
            }
            assertNotNull(target, "The exported workbook must contain the saved note, not only metadata");
            target.getCell(0).setCellType(CellType.BLANK);
            target.getCell(1).setCellValue("D3 edited");
            book.write(output);
            edited = output.toByteArray();
        }
        http.perform(multipart("/api/pecs/{id}/import-excel", pec)
                        .file(new MockMultipartFile("file", "notes.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", edited))
                        .header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        JsonNode notes = notes();
        assertEquals(2, notes.size());
        assertEquals("D3 edited", notes.get(0).get("text").asText());
        assertEquals("gravilha", notes.get(0).get("speedRating").asText());
        assertEquals(1.5, notes.get(0).get("originalTimestamp").asDouble());
        assertEquals("E4", notes.get(1).get("text").asText());
        assertEquals(3.5, notes.get(1).get("originalTimestamp").asDouble());
    }

    @Test
    void corruptWorkbookFailsWithoutDeletingPreviouslyPersistedNotes() throws Exception {
        JsonNode saved = note("Preserved", "observation", 7.5);
        http.perform(multipart("/api/pecs/{id}/import-excel", pec)
                        .file(new MockMultipartFile("file", "broken.xlsx", "application/octet-stream", new byte[]{1, 2, 3}))
                        .header("Authorization", token))
                .andExpect(status().isInternalServerError());
        JsonNode notes = notes();
        assertEquals(1, notes.size());
        assertEquals(saved, notes.get(0), "Failed parsing must preserve the original ID, text, observation and time");
    }

    @Test
    void alignmentPreservesEarlierAndUntimedNotesAndCompletedPecRejectsFurtherWrites() throws Exception {
        note("Earlier", "", 4.0);
        JsonNode target = note("Target", "", 10.0);
        note("Following", "", 20.0);
        note("Untimed", "", null);
        call(patch("/api/pecs/" + pec + "/notes/" + target.get("id").asLong() + "/align"),
                "{\"targetTimestamp\":3.5,\"shiftFollowing\":true,\"text\":\"Aligned\",\"speedRating\":\"ok\"}");
        JsonNode aligned = notes();
        assertEquals(4.0, aligned.get(0).get("originalTimestamp").asDouble());
        assertEquals(3.5, aligned.get(1).get("originalTimestamp").asDouble());
        assertEquals("Aligned", aligned.get(1).get("text").asText());
        assertEquals(13.5, aligned.get(2).get("originalTimestamp").asDouble());
        assertTrue(aligned.get(3).get("originalTimestamp").isNull());
        call(patch("/api/pecs/" + pec), "{\"status\":\"COMPLETED\"}");
        http.perform(post("/api/pecs/{id}/notes", pec).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"Rejected\"}"))
                .andExpect(status().isBadRequest());
        http.perform(post("/api/pecs/{id}/notes/apply-offset", pec).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"offsetSeconds\":10}"))
                .andExpect(status().isBadRequest());
        assertEquals(aligned, notes(), "Completion must lock both note creation and bulk timestamp updates");
    }

    private JsonNode note(String text, String observation, Double time) throws Exception {
        return call(post("/api/pecs/" + pec + "/notes"), "{\"text\":\"" + text
                + "\",\"speedRating\":\"" + observation + "\",\"originalTimestamp\":" + time + "}");
    }

    private JsonNode notes() throws Exception {
        return json.readTree(http.perform(get("/api/pecs/{id}/notes", pec).header("Authorization", token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode call(MockHttpServletRequestBuilder request, String body) throws Exception {
        return json.readTree(http.perform(request.header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString());
    }
}
