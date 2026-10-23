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
