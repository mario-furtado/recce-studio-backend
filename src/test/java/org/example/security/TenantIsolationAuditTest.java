package org.example.security;

import org.example.Main;
import org.example.config.OwnershipMigration;
import org.example.entity.AuthUserEntity;
import org.example.entity.RallyEntity;
import org.example.entity.TeamCarEntity;
import org.example.repository.AuthUserRepository;
import org.example.repository.NoteRepository;
import org.example.repository.OfflineRecceSyncRepository;
import org.example.repository.PecRepository;
import org.example.repository.RallyRepository;
import org.example.repository.TeamCarRepository;
import org.example.repository.TeamProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(
        classes = Main.class,
        properties = {
                "recce.test-user.enabled=false",
                "spring.datasource.url=jdbc:h2:mem:tenant-audit;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
                "spring.jpa.hibernate.ddl-auto=create-drop",
                "spring.jpa.show-sql=false",
                "recce.storage.type=local",
                "recce.upload-dir=target/audit-uploads"
        })
@AutoConfigureMockMvc
class TenantIsolationAuditTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AuthUserRepository authUserRepository;

    @Autowired
    private RallyRepository rallyRepository;

    @Autowired
    private PecRepository pecRepository;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private OfflineRecceSyncRepository syncRepository;

    @Autowired
    private TeamCarRepository teamCarRepository;

    @Autowired
    private TeamProfileRepository teamProfileRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OwnershipMigration ownershipMigration;

    @Autowired
    private org.example.service.FileStorageService fileStorageService;

    @BeforeEach
    void setUp() {
        noteRepository.deleteAll();
        syncRepository.deleteAll();
        pecRepository.deleteAll();
        rallyRepository.deleteAll();
        teamCarRepository.deleteAll();
        authUserRepository.deleteAll();
        teamProfileRepository.deleteAll();
        authUserRepository.save(user("user-a", "a@example.test", "token-a", "team-a"));
        authUserRepository.save(user("user-b", "b@example.test", "token-b", "team-b"));
        authUserRepository.save(user("user-no-team", "orphan@example.test", "token-no-team", null));
    }

    @Test
    void auditSec001StorageReferencesCannotBeSuppliedByClients() throws Exception {
        String rally = createRally("token-a", "Owned rally");
        mockMvc.perform(put("/api/rallies/{id}", rally)
                        .header("Authorization", bearer("token-a"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"logoStoragePath\":\"foreign/logo.png\"}"))
                .andExpect(status().isOk());
        assertEquals(null, rallyRepository.findById(rally).orElseThrow(AssertionError::new).getLogoStoragePath());
        MvcResult created = mockMvc.perform(post("/api/rallies")
                        .header("Authorization", bearer("token-a"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Injected\",\"year\":2026,\"surface\":\"TERRA\",\"location\":\"Test\","
                                + "\"logoStoragePath\":\"foreign/logo.png\"}"))
                .andExpect(status().isOk()).andReturn();
        assertEquals(null, rallyRepository.findById(jsonId(created)).orElseThrow(AssertionError::new).getLogoStoragePath());
        MvcResult car = mockMvc.perform(post("/api/team-profile/cars")
                        .header("Authorization", bearer("token-a"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Injected car\",\"carClass\":\"Rally2\",\"photoStoragePath\":\"foreign/car.png\"}"))
                .andExpect(status().isOk()).andReturn();
        assertEquals(null, teamCarRepository.findById(jsonId(car)).orElseThrow(AssertionError::new).getPhotoStoragePath());
    }

    @Test
    void auditSec001RejectsCrossTeamMediaReads() throws Exception {
        String rally = createRally("token-a", "Media rally");
        String pec = createPec("token-a", rally, "Media PEC");
        for (String kind : new String[]{"audio", "video"}) {
            byte[] bytes = ("private-" + kind).getBytes(java.nio.charset.StandardCharsets.UTF_8);
            String path = fileStorageService.store(
                    new MockMultipartFile("file", kind + ".webm", kind + "/webm", bytes), "test-media", kind);
            org.example.entity.PecEntity entity = pecRepository.findById(pec).orElseThrow(AssertionError::new);
            if ("audio".equals(kind)) {
                entity.setAudioStoragePath(path);
                entity.setAudioContentType("audio/webm");
            } else {
                entity.setVideoStoragePath(path);
                entity.setVideoContentType("video/webm");
            }
            pecRepository.save(entity);
            mockMvc.perform(get("/api/pecs/{id}/" + kind, pec)
                            .header("Authorization", bearer("token-b")))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/pecs/{id}/" + kind, pec))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(get("/api/pecs/{id}/" + kind, pec)
                            .header("Authorization", bearer("token-a")))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(content().bytes(bytes));
            mockMvc.perform(multipart("/api/pecs/{id}/" + kind, pec)
                            .file(new MockMultipartFile("file", kind + ".webm", kind + "/webm", bytes))
                            .header("Authorization", bearer("token-b")))
                    .andExpect(status().isNotFound());
            mockMvc.perform(delete("/api/pecs/{id}/" + kind, pec)
                            .header("Authorization", bearer("token-b")))
                    .andExpect(status().isNotFound());
            mockMvc.perform(multipart("/api/pecs/{id}/" + kind, pec)
                            .file(new MockMultipartFile("file", kind + ".webm", kind + "/webm", bytes))
                            .header("Authorization", bearer("token-a")))
                    .andExpect(status().isOk());
            mockMvc.perform(delete("/api/pecs/{id}/" + kind, pec)
                            .header("Authorization", bearer("token-a")))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void auditSec001SyncRetriesAndProfilesStayWithinAuthenticatedTeam() throws Exception {
        for (String team : new String[]{"a", "b"}) {
            String rally = createRally("token-" + team, "Rally " + team);
            String pec = createPec("token-" + team, rally, "PEC " + team);
            String syncId = null;
            for (int attempt = 0; attempt < 2; attempt++) {
                MvcResult result = mockMvc.perform(post("/api/offline-recces/sync")
                                .header("Authorization", bearer("token-" + team))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"sessionId\":\"same-session\",\"pecId\":\"" + pec + "\",\"markers\":[],\"gpsTrack\":[]}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.pecId").value(pec)).andReturn();
                String returnedId = objectMapper.readTree(result.getResponse().getContentAsString()).get("syncId").asText();
                if (attempt == 0) syncId = returnedId;
                else assertEquals(syncId, returnedId);
            }
            mockMvc.perform(patch("/api/team-profile")
                            .header("Authorization", bearer("token-" + team))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"id\":\"team-foreign\",\"name\":\"Profile " + team + "\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.id").value("team-" + team));
        }
        assertEquals(2, syncRepository.count());
        assertEquals("Profile a", teamProfileRepository.findById("team-a").orElseThrow(AssertionError::new).getName());
        assertEquals("Profile b", teamProfileRepository.findById("team-b").orElseThrow(AssertionError::new).getName());
    }

    @Test
    void auditSec001CreateCannotOverwriteForeignRally() throws Exception {
        String rallyA = createRally("token-a", "Original A");
        mockMvc.perform(post("/api/rallies")
                        .header("Authorization", bearer("token-b"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"" + rallyA + "\",\"name\":\"Overwrite\",\"year\":2026,"
                                + "\"surface\":\"TERRA\",\"location\":\"Test\"}"))
                .andExpect(status().isOk());
        assertEquals("team-a", rallyRepository.findById(rallyA).orElseThrow(AssertionError::new).getTeamProfileId());
        assertEquals("Original A", rallyRepository.findById(rallyA).orElseThrow(AssertionError::new).getName());
    }

    @Test
    void auditSec001CreateCannotOverwriteForeignNote() throws Exception {
        String rallyA = createRally("token-a", "Original A");
        String pecA = createPec("token-a", rallyA, "PEC A");
        String rallyB = createRally("token-b", "Original B");
        String pecB = createPec("token-b", rallyB, "PEC B");
        MvcResult note = mockMvc.perform(post("/api/pecs/{id}/notes", pecA)
                        .header("Authorization", bearer("token-a"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"Private note\"}"))
                .andExpect(status().isOk()).andReturn();
        long noteId = objectMapper.readTree(note.getResponse().getContentAsString()).get("id").asLong();
        mockMvc.perform(post("/api/pecs/{id}/notes", pecB)
                        .header("Authorization", bearer("token-b"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"id\":" + noteId + ",\"text\":\"Overwrite\"}"))
                .andExpect(status().isOk());
        assertEquals(pecA, noteRepository.findById(noteId).orElseThrow(AssertionError::new).getPecId());
    }

    @Test
    void auditSec001EnforcesTenantBoundaryAcrossDomainOperations() throws Exception {
        String rallyA = createRally("token-a", "Private rally A");

        mockMvc.perform(get("/api/rallies")
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get("/api/rallies")
                        .header("Authorization", bearer("token-no-team")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/auth/validate")
                        .header("Authorization", bearer("token-no-team")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/rallies/{id}", rallyA)
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/rallies/{id}", rallyA)
                        .header("Authorization", bearer("token-b"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Cross-team overwrite\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/rallies/{id}", rallyA)
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/rallies/{id}/pecs", rallyA)
                        .header("Authorization", bearer("token-b"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":1,\"name\":\"Foreign PEC\"}"))
                .andExpect(status().isNotFound());

        String pecA = createPec("token-a", rallyA, "Private PEC A");
        mockMvc.perform(get("/api/pecs/{id}", pecA)
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/pecs/{id}", pecA)
                        .header("Authorization", bearer("token-b"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Cross-team overwrite\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/pecs/{id}", pecA)
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/pecs/{id}/notes", pecA)
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/pecs/{id}/assets", pecA)
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/offline-recces/sync")
                        .header("Authorization", bearer("token-b"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"foreign-session\",\"pecId\":\"" + pecA + "\","
                                + "\"markers\":[],\"gpsTrack\":[]}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/offline-recces/sync")
                        .header("Authorization", bearer("token-a"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"owned-session\",\"pecId\":\"" + pecA + "\","
                                + "\"userEmail\":\"spoofed@example.test\",\"markers\":[],\"gpsTrack\":[]}"))
                .andExpect(status().isOk());
        assertEquals("a@example.test", syncRepository
                .findByOfflineSessionIdAndTeamProfileId("owned-session", "team-a")
                .orElseThrow(AssertionError::new)
                .getUserEmail());

        mockMvc.perform(get("/api/team-profile")
                        .header("Authorization", bearer("token-a")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("team-a"));
        mockMvc.perform(get("/api/team-profile")
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("team-b"));

        String carA = createCar("token-a", "Private car A");
        String carB = createCar("token-b", "Private car B");
        mockMvc.perform(get("/api/team-profile/cars")
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("Private car A"))));
        mockMvc.perform(patch("/api/team-profile/cars/{id}", carA)
                        .header("Authorization", bearer("token-b"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Cross-team overwrite\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/team-profile/cars/{id}", carA)
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/team-profile/cars/{id}/photo", carA)
                        .header("Authorization", bearer("token-b")))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/team-profile/cars/{id}/photo", carA))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/team-profile")
                        .header("Authorization", bearer("token-a"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"selectedCarId\":\"" + carB + "\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/rallies/{id}/logo", rallyA))
                .andExpect(status().isUnauthorized());

        createRally("token-b", "Private rally B");
        mockMvc.perform(get("/api/rallies")
                        .header("Authorization", bearer("token-a")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Private rally A"));

        mockMvc.perform(get("/api/rallies/{id}", rallyA)
                        .header("Authorization", bearer("token-a")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.teamProfileId").doesNotExist());
        mockMvc.perform(put("/api/rallies/{id}", rallyA)
                        .header("Authorization", bearer("token-a"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"location\":\"Updated fixture\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location").value("Updated fixture"));
        mockMvc.perform(patch("/api/pecs/{id}", pecA)
                        .header("Authorization", bearer("token-a"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Private PEC A updated\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Private PEC A updated"));
        mockMvc.perform(delete("/api/pecs/{id}", pecA)
                        .header("Authorization", bearer("token-a")))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/rallies/{id}", rallyA)
                        .header("Authorization", bearer("token-a")))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/team-profile/cars/{id}", carA)
                        .header("Authorization", bearer("token-a")))
                .andExpect(status().isNoContent());
    }

    @Test
    void auditSec001MigratesLegacyRecordsOnlyWhenTheOwnerIsUnambiguous() throws Exception {
        authUserRepository.deleteById("user-b");
        RallyEntity legacyRally = RallyEntity.builder()
                .name("Legacy rally")
                .year(2025)
                .surface("TERRA")
                .location("Legacy fixture")
                .status("DRAFT")
                .build();
        legacyRally = rallyRepository.save(legacyRally);
        TeamCarEntity legacyCar = new TeamCarEntity();
        legacyCar.setId("legacy-car");
        legacyCar.setName("Legacy car");
        legacyCar.setCarClass("Rally2");
        teamCarRepository.save(legacyCar);

        ownershipMigration.run();

        assertEquals("team-a", rallyRepository.findById(legacyRally.getId()).orElseThrow(AssertionError::new)
                .getTeamProfileId());
        assertEquals("team-a", teamCarRepository.findById("legacy-car").orElseThrow(AssertionError::new)
                .getTeamProfileId());
    }

    @Test
    void auditSec001DoesNotAssignLegacyRecordsWhenAnotherInactiveTeamExists() throws Exception {
        AuthUserEntity inactiveUser = authUserRepository.findById("user-b").orElseThrow(AssertionError::new);
        inactiveUser.setActive(false);
        authUserRepository.save(inactiveUser);
        RallyEntity legacyRally = RallyEntity.builder()
                .name("Ambiguous legacy rally")
                .year(2025)
                .surface("TERRA")
                .location("Legacy fixture")
                .status("DRAFT")
                .build();
        legacyRally = rallyRepository.save(legacyRally);

        ownershipMigration.run();

        assertEquals(null, rallyRepository.findById(legacyRally.getId()).orElseThrow(AssertionError::new)
                .getTeamProfileId());
    }

    private String createRally(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/rallies")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"year\":2026,"
                                + "\"surface\":\"TERRA\",\"location\":\"Test fixture\","
                                + "\"status\":\"DRAFT\",\"teamProfileId\":\"team-b\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return jsonId(result);
    }

    private String createPec(String token, String rallyId, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/rallies/{id}/pecs", rallyId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":1,\"name\":\"" + name + "\",\"distanceKm\":1.2}"))
                .andExpect(status().isCreated())
                .andReturn();
        return jsonId(result);
    }

    private String createCar(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/team-profile/cars")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"carClass\":\"Rally2\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return jsonId(result);
    }

    private String jsonId(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.get("id").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private AuthUserEntity user(String id, String email, String token, String teamProfileId) {
        AuthUserEntity user = new AuthUserEntity();
        user.setId(id);
        user.setEmail(email);
        user.setPasswordHash("not-used-by-this-audit");
        user.setToken(token);
        user.setActive(true);
        user.setTeamProfileId(teamProfileId);
        return user;
    }
}
