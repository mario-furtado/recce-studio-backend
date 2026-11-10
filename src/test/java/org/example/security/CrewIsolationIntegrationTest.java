package org.example.security;

import com.fasterxml.jackson.databind.*;
import org.example.Main;
import org.example.entity.*;
import org.example.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes=Main.class, properties={"recce.crews.enabled=true","recce.test-user.enabled=false",
    "spring.datasource.url=jdbc:h2:mem:crew-isolation;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.jpa.hibernate.ddl-auto=create-drop","spring.jpa.show-sql=false","recce.storage.type=local","recce.upload-dir=target/crew-test-uploads"})
@AutoConfigureMockMvc
class CrewIsolationIntegrationTest {
    @Autowired MockMvc http; @Autowired ObjectMapper json;
    @Autowired AuthUserRepository users; @Autowired CrewRepository crews; @Autowired TeamProfileRepository profiles;
    @Autowired TeamCarRepository cars; @Autowired RallyRepository rallies; @Autowired PecRepository pecs;
    @Autowired NoteRepository notes; @Autowired OfflineRecceSyncRepository syncs;
    @BeforeEach void setup() {
        notes.deleteAll(); syncs.deleteAll(); pecs.deleteAll(); rallies.deleteAll(); cars.deleteAll(); crews.deleteAll(); profiles.deleteAll(); users.deleteAll();
        for(String id:Arrays.asList("a","b","third","legacy")) {
            AuthUserEntity u=new AuthUserEntity(); u.setId(id); u.setEmail(id+"@crew.invalid"); u.setPasswordHash("unused-test-hash"); u.setToken("token-"+id);
            u.setTokenExpiresAtEpochMillis(System.currentTimeMillis()+3600000L); u.setEmailVerified(true); if(id.equals("legacy")) u.setTeamProfileId("legacy-profile"); users.save(u);
        }
        TeamProfileEntity legacy=new TeamProfileEntity(); legacy.setId("legacy-profile"); legacy.setName("Legacy unchanged"); profiles.save(legacy);
    }
    ResultActions call(MockHttpServletRequestBuilder request,String user,String crew) throws Exception {
        request.header("Authorization","Bearer token-"+user); if(crew!=null) request.header("X-Crew-Id",crew); return http.perform(request);
    }
    MockHttpServletRequestBuilder body(MockHttpServletRequestBuilder r,String content) { return r.contentType(MediaType.APPLICATION_JSON).content(content); }
    String field(ResultActions result,String field) throws Exception {return json.readTree(result.andReturn().getResponse().getContentAsByteArray()).path(field).asText();}
    String crew(String user,String name) throws Exception { return create(user,name,UUID.randomUUID().toString()); }
    String create(String user,String name,String key) throws Exception {
        return field(call(body(post("/api/crews"),json.createObjectNode().put("name",name).toString()).header("Idempotency-Key",key),user,null).andExpect(status().isOk()),"id");
    }
    String rally(String crew) throws Exception { return field(call(body(post("/api/rallies"),"{\"name\":\"Rally\",\"year\":2026,\"surface\":\"TERRA\",\"location\":\"Fixture\",\"teamProfileId\":\"spoof\"}"),"a",crew).andExpect(status().isOk()),"id"); }
    String pec(String crew,String rally) throws Exception {return field(call(body(post("/api/rallies/"+rally+"/pecs"),"{\"name\":\"PEC\",\"number\":1,\"distanceKm\":2}"),"a",crew).andExpect(status().isCreated()),"id");}
    @Test void accountOwnsTwoIndependentContextsWithoutInviteOrFictionalResources() throws Exception {
        String a=crew("a","Crew A"), b=crew("a","Crew B");
        assertNotEquals(a,b); assertNull(users.findById("a").get().getTeamProfileId());
        assertEquals("a",crews.findById(a).get().ownerAccountId);
        String ra=rally(a),rb=rally(b);
        call(get("/api/rallies"),"a",a).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(ra));
        call(get("/api/rallies"),"a",b).andExpect(jsonPath("$[0].id").value(rb));
        call(get("/api/team-profile/cars"),"a",a).andExpect(content().json("[]"));
        call(get("/api/team-profile"),"a",a).andExpect(jsonPath("$.driverName").isEmpty()).andExpect(jsonPath("$.car").isEmpty()); assertEquals(0,cars.count());
        call(get("/api/crews"),"a",null).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[0].creationKey").doesNotExist()).andExpect(jsonPath("$[0].ownerAccountId").doesNotExist());
        call(get("/api/rallies"),"a",null).andExpect(status().isForbidden());
    }
    @Test void sportingNamesAndSpoofedOwnershipNeverGrantAccess() throws Exception {
        String a=crew("a","Crew A");
        call(body(patch("/api/team-profile"),"{\"driverName\":\"third@crew.invalid\",\"coDriverName\":\"third\"}"),"a",a).andExpect(status().isOk());
        call(get("/api/crews"),"third",null).andExpect(content().json("[]"));
        call(get("/api/team-profile"),"third",a).andExpect(status().isNotFound());
        call(body(post("/api/crews"),"{\"name\":\"Forged\",\"ownerAccountId\":\"a\"}").header("Idempotency-Key",UUID.randomUUID().toString()),"third",null).andExpect(status().isBadRequest());
        call(get("/api/rallies").header("X-Team-Id",a),"third",null).andExpect(status().isForbidden());
        assertEquals("a",crews.findById(a).get().ownerAccountId);
    }
    @Test void foreignOrUnknownHeadersNeverFallbackAndMultipleHeadersAreRejected() throws Exception {
        String a=crew("a","A"); String b=crew("b","B"); rally(a);
        for(String id:Arrays.asList(b,"unknown")) call(get("/api/rallies"),"a",id).andExpect(status().isNotFound()).andExpect(content().json("{\"message\":\"Tripulação indisponível.\"}"));
        call(get("/api/rallies").header("X-Crew-Id",a,b),"a",null).andExpect(status().isBadRequest());
        call(get("/api/rallies"),"a"," ").andExpect(status().isBadRequest());
        call(get("/api/team-profile/stats"),"b",a).andExpect(status().isNotFound());
        call(get("/api/auth/me"),"a",b).andExpect(status().isOk()).andExpect(jsonPath("$.id").value("a"));
    }
    @Test void ownedCrewsStillCannotMixParentsChildrenNotesOrFiles() throws Exception {
        String a=crew("a","A"),b=crew("a","B"),ra=rally(a),rb=rally(b),pa=pec(a,ra),pb=pec(b,rb);
        String note=field(call(body(post("/api/pecs/"+pa+"/notes"),"{\"text\":\"E3\",\"originalTimestamp\":1}"),"a",a).andExpect(status().isOk()),"id");
        for(String media:Arrays.asList("audio","video")) {
            String mime=media.equals("audio")?"audio/webm":"video/mp4";
            call(multipart("/api/pecs/"+pb+"/"+media).file(new MockMultipartFile("file","sample",mime,new byte[]{1,2})),"a",b).andExpect(status().isOk());
            call(get("/api/pecs/"+pb+"/"+media),"a",b).andExpect(status().isOk()).andExpect(content().bytes(new byte[]{1,2}));
        }
        // Existing collection contract returns an empty filtered list for foreign/missing parents.
        for(String parent:Arrays.asList(rb,"unknown")) call(get("/api/rallies/"+parent+"/pecs"),"a",a).andExpect(status().isOk()).andExpect(content().json("[]",true));
        for(String path:Arrays.asList("/api/rallies/"+rb,"/api/pecs/"+pb,"/api/pecs/"+pb+"/notes","/api/pecs/"+pb+"/assets","/api/pecs/"+pb+"/audio","/api/pecs/"+pb+"/video","/api/pecs/"+pb+"/gps/track","/api/pecs/"+pb+"/reccebook-cover","/api/pecs/"+pb+"/download-template","/api/rallies/"+rb+"/logo"))
            call(get(path),"a",a).andExpect(status().isNotFound());
        call(body(post("/api/rallies/"+rb+"/pecs"),"{\"name\":\"Spoof\"}"),"a",a).andExpect(status().isNotFound());
        call(body(patch("/api/pecs/"+pb+"/notes/"+note),"{\"text\":\"Changed\"}"),"a",b).andExpect(status().isNotFound());
        call(body(patch("/api/pecs/"+pb+"/notes/"+note+"/align"),"{\"text\":\"Changed\",\"targetTimestamp\":8}"),"a",b).andExpect(status().isNotFound());
        call(delete("/api/pecs/"+pb+"/notes/"+note),"a",b).andExpect(status().isNotFound());
        call(delete("/api/pecs/"+pb),"a",a).andExpect(status().isNotFound());
        call(multipart("/api/pecs/"+pb+"/audio").file(new MockMultipartFile("file","audio.webm","audio/webm",new byte[]{1,2})),"a",a).andExpect(status().isNotFound());
        assertEquals(2,pecs.count()); assertEquals("E3",notes.findById(Long.valueOf(note)).get().getText());
        call(get("/api/pecs/"+pa+"/notes"),"a",a).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        call(get("/api/pecs/"+pa+"/download-template"),"a",a).andExpect(status().isOk());
    }
    @Test void carsImagesAndBaseSystemBelongToTheSelectedCrew() throws Exception {
        String a=crew("a","A"),b=crew("a","B");
        String car=field(call(body(post("/api/team-profile/cars"),"{\"name\":\"Actual car\",\"carClass\":\"Rally4\",\"teamProfileId\":\"spoof\"}"),"a",a).andExpect(status().isOk()),"id");
        call(body(patch("/api/team-profile"),"{\"noteSystem\":\"Personal crew scale\"}"),"a",a).andExpect(status().isOk());
        call(get("/api/team-profile/cars"),"a",b).andExpect(content().json("[]"));
        call(get("/api/team-profile"),"a",b).andExpect(jsonPath("$.noteSystem").value("1-6 (1 Lento, 6 Rapido)"));
        call(post("/api/team-profile/cars/"+car+"/select"),"a",b).andExpect(status().isNotFound());
        call(get("/api/team-profile/cars/"+car+"/photo"),"a",b).andExpect(status().isNotFound());
        byte[] photo=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=");
        call(multipart("/api/team-profile/cars/"+car+"/photo").file(new MockMultipartFile("file","car.png","image/png",photo)),"a",a).andExpect(status().isOk());
        call(get("/api/team-profile/cars/"+car+"/photo"),"a",a).andExpect(status().isOk()).andExpect(content().bytes(photo));
        call(get("/api/team-profile/cars/"+car+"/photo"),"a",b).andExpect(status().isNotFound());
        call(body(post("/api/rallies"),"{\"name\":\"Cross car\",\"year\":2026,\"surface\":\"TERRA\",\"location\":\"Fixture\",\"carId\":\""+car+"\"}"),"a",b).andExpect(status().isNotFound()); assertEquals(0,rallies.count());
        call(get("/api/reccebook-template"),"a",a).andExpect(status().isOk());
        assertEquals(a,cars.findById(car).get().getTeamProfileId());
    }
    @Test void concurrentCreationAndRetriesAreAtomicAndKeysAreAccountBound() throws Exception {
        String key=UUID.randomUUID().toString(); ExecutorService pool=Executors.newFixedThreadPool(2);
        try {
            List<Future<String>> results=pool.invokeAll(Arrays.asList(()->create("a","Same",key),()->create("a","Same",key)));
            assertEquals(results.get(0).get(),results.get(1).get()); assertEquals(1,crews.count()); assertEquals(2,profiles.count());
            assertEquals(results.get(0).get(),create("a","Same",key));
            assertNotEquals(results.get(0).get(),create("b","Same",key));
            call(body(post("/api/crews"),"{\"name\":\"Different\"}").header("Idempotency-Key",key),"a",null).andExpect(status().isConflict());
        } finally {pool.shutdownNow();}
    }
    @Test void invalidCreationDoesNotPersistPartialData() throws Exception {
        for(String name:Arrays.asList(" ","a\nb\nc",String.join("",Collections.nCopies(101,"x"))))
            call(body(post("/api/crews"),json.createObjectNode().put("name",name).toString()).header("Idempotency-Key",UUID.randomUUID().toString()),"a",null).andExpect(status().isBadRequest());
        call(body(post("/api/crews"),"{\"name\":\"Valid\"}"),"a",null).andExpect(status().isBadRequest());
        assertEquals(0,crews.count()); assertEquals(1,profiles.count());
    }
    @Test void invalidSessionsCannotUseCrewContextAndLegacyFallbackIsPreserved() throws Exception {
        String a=crew("a","A"); http.perform(get("/api/crews")).andExpect(status().isUnauthorized());
        AuthUserEntity u=users.findById("a").get(); u.setActive(false); users.save(u);
        call(get("/api/rallies"),"a",a).andExpect(status().isUnauthorized()); call(get("/api/crews"),"a",null).andExpect(status().isUnauthorized());
        call(get("/api/team-profile"),"legacy",null).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Legacy unchanged"));
        assertNull(profiles.findById("legacy-profile").get().getManagedCrew()); assertEquals("legacy-profile",users.findById("legacy").get().getTeamProfileId());
        assertFalse(crews.existsById("legacy-profile"));
    }
    @Test void newContextsCannotAdoptOrSyncLegacyOfflineSessions() throws Exception {
        String a=crew("a","A");
        call(body(post("/api/offline-recces/sync"),"{}"),"a",a).andExpect(status().isForbidden()); assertEquals(0,syncs.count());
        String rally=rally(a);
        call(body(post("/api/offline-recces;v=1/sync"),"{\"sessionId\":\"matrix-session\",\"rallyId\":\""+rally+"\",\"newPec\":{\"number\":1,\"name\":\"Must not sync\",\"distanceKm\":1},\"markers\":[],\"gpsTrack\":[]}"),"a",a).andExpect(status().isForbidden());
        assertEquals(0,syncs.count()); assertEquals(0,pecs.count());
        call(get("/api/crews"),"a",null).andExpect(status().isOk());
        call(get("/api/crews;v=1"),"a",null).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }
    @Test void countsStayInTheCrewButDictionaryRulesStayPersonal() throws Exception {
        String a=crew("a","A"),b=crew("a","B"),other=crew("b","Other"); String ra=rally(a); pec(a,ra); pec(a,ra);
        call(get("/api/team-profile/stats"),"a",a).andExpect(status().isOk()).andExpect(jsonPath("$.totalPecs").value(2));
        call(get("/api/team-profile/stats"),"a",b).andExpect(status().isOk()).andExpect(jsonPath("$.totalPecs").value(0));
        String rule=field(call(body(post("/api/note-dictionary-rules"),"{\"phrase\":\"crew-specific-test\",\"symbol\":\"E3\",\"meaning\":\"Private\",\"category\":\"CURVE\",\"enabled\":true}"),"a",a).andExpect(status().isOk()),"id");
        String own=call(get("/api/note-dictionary-rules"),"a",b).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(); assertTrue(own.contains(rule));
        String foreign=call(get("/api/note-dictionary-rules"),"b",other).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(); assertFalse(foreign.contains(rule));
    }
    @Test void missingNewProfileFailsClosedWithoutRecreatingLegacyDefaults() throws Exception {
        String a=crew("a","A"); profiles.deleteById(a);
        call(get("/api/team-profile"),"a",a).andExpect(status().isNotFound()); assertFalse(profiles.existsById(a)); assertEquals(0,cars.count());
    }
}
