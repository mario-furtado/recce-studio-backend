package org.example.migration;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.example.Main;
import org.example.entity.*;
import org.example.repository.*;
import org.example.service.*;
import org.example.config.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.*;
import javax.sql.DataSource;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.jar.*;
import static org.example.migration.MigrationSnapshot.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes=Main.class,properties={"recce.test-user.enabled=false","recce.crews.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop","spring.jpa.show-sql=false","recce.storage.type=local"})
@AutoConfigureMockMvc
class LegacyCrewMigrationIntegrationTest {
    static final Path WORK=createWork();
    static Path createWork(){try{Path parent=Paths.get(".factory-results/FEAT-020");Files.createDirectories(parent);Path dir=Files.createTempDirectory(parent,"runtime-").toAbsolutePath();Files.createDirectory(dir.resolve("media"));return dir;}catch(Exception ex){throw new IllegalStateException(ex);}}
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",()->"jdbc:h2:file:"+WORK.resolve("source")+";DB_CLOSE_ON_EXIT=FALSE");
        registry.add("recce.upload-dir",()->WORK.resolve("media").toString());
    }
    @Autowired MockMvc http; @Autowired ObjectMapper json; @Autowired DataSource source; @Autowired JdbcTemplate sql;
    @Autowired AuthUserRepository users; @Autowired TeamProfileRepository profiles; @Autowired CrewRepository crews;
    @Autowired LegacyCrewMigrationRepository migrations; @Autowired RallyRepository rallies; @Autowired PecRepository pecs;
    @Autowired NoteRepository notes; @Autowired TeamCarRepository cars; @Autowired OfflineRecceSyncRepository syncs;
    @Autowired NotebookPreferencesRepository preferences; @Autowired AuthService auth; @Autowired LegacyMigrationAccess access;
    @Autowired OwnershipMigration oldBackfill; @Autowired AccountRateLimitRepository limits;
    Map<String,String> rallyIds; Path media=WORK.resolve("media"),backup,restore,manifest;String approval;
    final byte[] audio={3,5,7,9};
    @BeforeEach void setup() throws Exception {
        // Reset only this isolated fixture to a pre-cutover state between test scenarios.
        sql.execute("alter table auth_users drop constraint if exists fk_legacy_auth_context");sql.execute("drop table if exists legacy_auth_contexts");
        migrations.deleteAll();notes.deleteAll();syncs.deleteAll();pecs.deleteAll();rallies.deleteAll();cars.deleteAll();crews.deleteAll();users.deleteAll();profiles.deleteAll();preferences.deleteAll();limits.deleteByIdNot(AccountRateLimiter.GUARD);
        rallyIds=new HashMap<>();
        for(String id:Arrays.asList("a","b")) {
            TeamProfileEntity p=new TeamProfileEntity();p.setId("legacy-"+id);p.setName("Original "+id);profiles.save(p);
            AuthUserEntity u=new AuthUserEntity();u.setId("user-"+id);u.setEmail(id+"@migration.invalid");u.setPasswordHash(BCrypt.hashpw("legacy-password-2026",BCrypt.gensalt()));u.setTeamProfileId(p.getId());u.setToken("token-"+id);u.setTokenExpiresAtEpochMillis(System.currentTimeMillis()+3600000);users.save(u);
            RallyEntity r=new RallyEntity();r.setName("Original rally "+id);r.setYear(2026);r.setLocation("Original place");r.setSurface("TERRA");r.setStatus("DRAFT");r.setTeamProfileId(p.getId());r=rallies.save(r);rallyIds.put(id,r.getId());
            PecEntity pec=new PecEntity("pec-"+id,1,"Original PEC "+id,2,1,"DRAFT",LocalDate.of(2026,11,2),r);pecs.save(pec);
            NoteEntity note=new NoteEntity();note.setPecId(pec.getId());note.setText("E3 "+id);note.setOriginalTimestamp(2.0);notes.save(note);
            NotebookPreferencesEntity prefs=new NotebookPreferencesEntity();prefs.setUserId(u.getId());prefs.setSettings("{\"personal\":\""+id+"\"}");preferences.save(prefs);
        }
        http.perform(multipart("/api/pecs/pec-a/audio").file(new MockMultipartFile("file","original.webm","audio/webm",audio)).header("Authorization","Bearer token-a")).andExpect(status().isOk());
        OfflineRecceSyncEntity receipt=new OfflineRecceSyncEntity();receipt.setId("original-receipt");receipt.setOfflineSessionId("original-session");receipt.setPecId("pec-a");receipt.setTeamProfileId("legacy-a");receipt.setUserEmail("a@migration.invalid");receipt.setNotesCount(1);receipt.setDurationSeconds(2);receipt.setSyncedAt(LocalDateTime.now());syncs.save(receipt);
    }
    void prepareA() throws Exception {
        Path operation=Files.createTempDirectory(WORK,"operation-");backup=operation.resolve("backup");restore=operation.resolve("restore");manifest=operation.resolve("manifest.json");
        try(Connection db=source.getConnection()) {
            JsonNode ctx=LegacyCrewMigrationTool.plan(db,media).path("contexts").get(0);
            ObjectNode approved=JSON.createObjectNode().put("version",1).put("approvedBy","test-operator").put("approvalReference","isolated-only");
            ObjectNode entry=approved.putArray("entries").addObject().put("teamProfileId","legacy-a").put("ownerAccountId","user-a").put("expectedDigest",ctx.path("digest").asText());entry.putArray("legacyAccountIds").add("user-a");
            writeNew(manifest,approved);approval=fileHash(manifest);MigrationSnapshot.backup(db,media,backup);
        }
        MigrationSnapshot.restoreCheck(backup,restore,"sa","");
    }
    void applyA() throws Exception {try(Connection db=source.getConnection()){LegacyCrewMigrationTool.apply(db,media,manifest,approval,backup,restore.resolve("restore-proof.json"),"sa","",1);}}
    ResultActions getA(String path) throws Exception {return http.perform(get(path).header("Authorization","Bearer token-a"));}
    @Test void convertedOwnerKeepsOldUrlsIdsCredentialsPreferencesAndMediaWithUiFlagsOff() throws Exception {
        String hash=users.findById("user-a").get().getPasswordHash();prepareA();applyA();
        AuthUserEntity converted=users.findById("user-a").get();assertNull(converted.getTeamProfileId());assertTrue(converted.getLegacyCrewMigrated());assertNull(converted.getEmailVerified());assertEquals(hash,converted.getPasswordHash());
        getA("/api/auth/validate").andExpect(status().isOk());getA("/api/auth/me").andExpect(status().isOk()).andExpect(jsonPath("$.hasWorkspace").value(true)).andExpect(jsonPath("$.crewsEnabled").value(false));
        getA("/api/rallies").andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(rallyIds.get("a")));
        getA("/api/pecs/pec-a/notes").andExpect(status().isOk()).andExpect(jsonPath("$[0].text").value("E3 a"));
        getA("/api/pecs/pec-a/audio").andExpect(status().isOk()).andExpect(content().bytes(audio));
        String login=http.perform(post("/api/auth/login").contentType("application/json").content("{\"email\":\"a@migration.invalid\",\"password\":\"legacy-password-2026\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.profile.id").value("legacy-a")).andReturn().getResponse().getContentAsString();
        assertTrue(json.readTree(login).path("token").asText().length()>20);assertEquals(1,migrations.count());assertEquals(2,notes.count());assertEquals(1,syncs.count());
        assertEquals("{\"personal\":\"a\"}",preferences.findById("user-a").get().getSettings());
        CrewService enabled=new CrewService(crews,users,profiles,Clock.systemUTC(),true,access);assertEquals("legacy-a",enabled.requireOwned("user-a","legacy-a").id);
    }
    @Test void thirdPartyCannotUseOldLinksHeaderOrReattachAnAccountToConvertedContext() throws Exception {
        prepareA();applyA();
        for(String path:Arrays.asList("/api/rallies/"+rallyIds.get("a"),"/api/pecs/pec-a","/api/pecs/pec-a/notes","/api/pecs/pec-a/audio","/api/pecs/pec-a/reccebook-cover"))
            http.perform(get(path).header("Authorization","Bearer token-b")).andExpect(status().isNotFound());
        http.perform(get("/api/rallies").header("Authorization","Bearer token-b").header("X-Crew-Id","legacy-a")).andExpect(status().isForbidden());
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->sql.update("update auth_users set team_profile_id='legacy-a' where id='user-b'"));
        http.perform(get("/api/rallies").header("Authorization","Bearer token-b")).andExpect(jsonPath("$[0].id").value(rallyIds.get("b")));
    }
    @Test void compatibleRollbackDoesNotRestoreRevocationOrLosePostMigrationWrites() throws Exception {
        prepareA();applyA();
        http.perform(post("/api/rallies").header("Authorization","Bearer token-a").contentType("application/json").content("{\"name\":\"After cutover\",\"year\":2026,\"surface\":\"TERRA\",\"location\":\"New place\"}")).andExpect(status().isOk());
        http.perform(post("/api/auth/logout").header("Authorization","Bearer token-a")).andExpect(status().isNoContent());
        try(Connection db=source.getConnection()){assertThrows(IllegalArgumentException.class,()->LegacyCrewMigrationTool.checkRollback(db,jar("old",false)));LegacyCrewMigrationTool.checkRollback(db,jar("compatible",true));}
        applyA();getA("/api/rallies").andExpect(status().isUnauthorized());assertEquals(3,rallies.count());assertEquals(1,migrations.count());assertNull(users.findById("user-a").get().getTokenExpiresAtEpochMillis());
    }
    @Test void ambiguousMembersKeepTheirExistingBoundedLegacyAccessUntilAnExplicitDecision() throws Exception {
        AuthUserEntity third=new AuthUserEntity();third.setId("third");third.setEmail("third@migration.invalid");third.setPasswordHash("unused");third.setToken("third-token");third.setTokenExpiresAtEpochMillis(System.currentTimeMillis()+60000);third.setTeamProfileId("legacy-a");users.save(third);
        prepareA();assertThrows(IllegalArgumentException.class,this::applyA);
        assertEquals(0,migrations.count());assertEquals(0,crews.count());assertEquals("legacy-a",users.findById("user-a").get().getTeamProfileId());
        http.perform(get("/api/rallies").header("Authorization","Bearer third-token")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }
    @Test void journalDivergenceFailsClosedInsteadOfUsingTheLegacyField() throws Exception {
        prepareA();applyA();sql.update("update legacy_crew_migrations set owner_account_id='user-b' where team_profile_id='legacy-a'");
        getA("/api/rallies").andExpect(status().isServiceUnavailable());getA("/api/auth/me").andExpect(status().isServiceUnavailable());
        assertNull(users.findById("user-a").get().getTeamProfileId());assertEquals(2,rallies.count());
    }
    @Test void startupBackfillAndTestBootstrapCannotReintroduceOldAuthorityAfterCutover() throws Exception {
        prepareA();applyA();RallyEntity orphan=new RallyEntity();orphan.setName("Unassigned");orphan.setYear(2026);orphan.setLocation("Unknown");orphan.setSurface("TERRA");orphan=rallies.save(orphan);oldBackfill.run();assertNull(rallies.findById(orphan.getId()).get().getTeamProfileId());
        TeamProfileService profileService=mock(TeamProfileService.class);
        TestUserBootstrap bootstrap=new TestUserBootstrap(users,profileService,"dev","","127.0.0.1",true,"different@migration.invalid","fixture-password",new MockEnvironment());
        assertThrows(IllegalStateException.class,bootstrap::run);verifyNoInteractions(profileService);
        org.example.dto.AuthRequestDTO registration=new org.example.dto.AuthRequestDTO();registration.setEmail("new@migration.invalid");registration.setPassword("fixture-password");assertThrows(IllegalStateException.class,()->auth.register(registration));assertEquals(2,profiles.count());
    }
    @Test void oldSyncReceiptReplaysWithoutDuplicatingPecOrNotesAfterCutover() throws Exception {
        prepareA();applyA();
        for(int i=0;i<2;i++)http.perform(post("/api/offline-recces/sync").header("Authorization","Bearer token-a").contentType("application/json").content("{\"sessionId\":\"original-session\",\"pecId\":\"pec-a\",\"markers\":[],\"gpsTrack\":[]}")).andExpect(status().isOk()).andExpect(jsonPath("$.syncId").value("original-receipt"));
        assertEquals(2,pecs.count());assertEquals(2,notes.count());assertEquals(1,syncs.count());
    }
    @Test void restoredMediaBytesCanBeServedAtTheirPreservedOriginalPaths() throws Exception {
        prepareA();Path original=Paths.get(pecs.findById("pec-a").get().getAudioStoragePath());Path relative=media.relativize(original);
        Files.write(original,new byte[]{0});Files.copy(restore.resolve("media").resolve(relative),original,StandardCopyOption.REPLACE_EXISTING);
        getA("/api/pecs/pec-a/audio").andExpect(status().isOk()).andExpect(content().bytes(audio));
        try(Connection restored=LegacyCrewMigrationTool.connect(restore.resolve("restored"),"sa","")) {
            assertEquals(2,LegacyCrewMigrationTool.count(restored,"select count(*) from notes"));assertEquals(1,LegacyCrewMigrationTool.count(restored,"select count(*) from offline_recce_syncs where id='original-receipt'"));
        }
    }
    Path jar(String name,boolean supported) throws Exception {Path path=WORK.resolve(name+UUID.randomUUID()+".jar");Manifest m=new Manifest();m.getMainAttributes().putValue("Manifest-Version","1.0");if(supported)m.getMainAttributes().putValue("Recce-Authorization",LegacyCrewMigrationTool.CAPABILITY);try(JarOutputStream out=new JarOutputStream(Files.newOutputStream(path),m)){}return path;}
}
