package org.example.e2e;

import org.example.Main;
import org.example.dto.AuthRequestDTO;
import org.example.service.AuthService;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.context.TypeExcludeFilter;
import org.springframework.core.type.classreading.MetadataReader;
import org.springframework.core.type.classreading.MetadataReaderFactory;
import org.springframework.context.ApplicationContext;
import org.example.repository.AuthUserRepository;
import org.example.repository.NoteRepository;
import org.example.repository.NotebookPreferencesRepository;
import org.example.repository.PecRepository;
import org.example.repository.RallyReadGrantRepository;
import org.example.repository.RallyRepository;
import org.example.entity.AuthUserEntity;
import org.example.entity.NoteEntity;
import org.example.entity.NotebookPreferencesEntity;
import org.example.entity.PecEntity;
import org.example.entity.RallyEntity;
import org.example.entity.RallyReadGrantEntity;

/** Test-classpath only: never included in the production jar or component scan. */
public final class E2eServer {
    public static void main(String[] args) {
        String password = System.getenv("RECCE_E2E_PASSWORD");
        if (password == null || password.length() < 32) {
            throw new IllegalArgumentException("An ephemeral E2E password is required.");
        }
        String uploads = System.getProperty("recce.e2e.uploads");
        if (uploads == null) throw new IllegalArgumentException("An isolated upload directory is required.");
        SpringApplication application = new SpringApplication(Main.class, Seed.class);
        // Main's component scan also sees target/test-classes in this harness. Exclude
        // auxiliary test configurations so every request uses the actual JPA services.
        application.addInitializers(context -> context.getBeanFactory().registerSingleton("e2eTestConfigurationFilter",
                new TypeExcludeFilter() {
                    @Override
                    public boolean match(MetadataReader reader, MetadataReaderFactory factory) {
                        return reader.getAnnotationMetadata().hasAnnotation(TestConfiguration.class.getName());
                    }
                }));
        application.run(
                "--server.address=127.0.0.1", "--server.port=18765",
                "--spring.datasource.url=jdbc:h2:mem:recce-e2e;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
                "--spring.datasource.username=sa", "--spring.datasource.password=",
                "--spring.jpa.hibernate.ddl-auto=create-drop", "--spring.jpa.show-sql=false",
                "--spring.h2.console.enabled=false", "--recce.environment=test",
                "--recce.test-user.enabled=false", "--recce.storage.type=local",
                "--recce.account.enabled=true", "--recce.account.rate-limit.limit=1000",
                "--recce.crews.enabled=true",
                "--recce.upload-dir=" + uploads, "--recce.auth.token-ttl-seconds=3600");
    }

    @TestConfiguration
    static class Seed {
        @Bean @org.springframework.context.annotation.Primary
        Mailbox e2eMailbox() { return new Mailbox(); }

        @Bean
        org.springframework.web.servlet.function.RouterFunction<org.springframework.web.servlet.function.ServerResponse> mailboxRoute(Mailbox mailbox) {
            return org.springframework.web.servlet.function.RouterFunctions.route()
                .GET("/e2e/mailbox", request -> {
                    if (!System.getenv("RECCE_E2E_PASSWORD").equals(request.headers().firstHeader("X-E2E-Key"))) return org.springframework.web.servlet.function.ServerResponse.status(403).build();
                    return org.springframework.web.servlet.function.ServerResponse.ok().body(mailbox.messages.stream()
                        .filter(m -> m.get("email").equals(request.param("email").orElse(""))).collect(java.util.stream.Collectors.toList()));
                }).build();
        }
        @Bean
        InitializingBean e2eAccounts(AuthService auth, ApplicationContext context) {
            return () -> {
                java.util.Map<String, AuthUserRepository> repositories = context.getBeansOfType(AuthUserRepository.class);
                if (repositories.size() != 1 || repositories.values().stream().anyMatch(repo -> org.mockito.Mockito.mockingDetails(repo).isMock())) {
                    throw new IllegalStateException("E2E requires exactly one real AuthUserRepository; test mocks must not be scanned.");
                }
                for (String account : new String[]{"owner", "other", "migrated"}) {
                    AuthRequestDTO request = new AuthRequestDTO();
                    request.setEmail(account + "@e2e.invalid");
                    request.setPassword(System.getenv("RECCE_E2E_PASSWORD"));
                    request.setTeamName("E2E " + account);
                    auth.register(request);
                }
                migratedFixture(context);
                sharedRallyFixture(context);
            };
        }
    }

    private static void sharedRallyFixture(ApplicationContext context) {
        AuthUserRepository users = context.getBean(AuthUserRepository.class);
        AuthUserEntity migrated = users.findByEmailIgnoreCase("migrated@e2e.invalid").get();
        AuthUserEntity reader = new AuthUserEntity();
        reader.setId("e2e-reader");
        reader.setEmail("reader@e2e.invalid");
        reader.setEmailVerified(true);
        reader.setPasswordHash(migrated.getPasswordHash());
        reader.setToken(java.util.UUID.randomUUID().toString());
        users.save(reader);

        RallyEntity rally = new RallyEntity();
        rally.setName("Rali partilhado FEAT021");
        rally.setYear(2026);
        rally.setSurface("TERRA");
        rally.setLocation("Fixture");
        rally.setStatus("COMPLETED");
        rally.setTeamProfileId(context.getBean(AuthService.class).getWorkspaceTeamProfileId(migrated));
        rally = context.getBean(RallyRepository.class).save(rally);
        PecRepository pecs = context.getBean(PecRepository.class);
        PecEntity pec = new PecEntity("shared-e2e-pec", 1, "PEC partilhada", 2, 1, "COMPLETED", java.time.LocalDate.now(), rally);
        pec.setAudioFileName("legacy.wav");
        pec.setAudioContentType("audio/wav");
        pec.setAudioStoragePath(pecs.findById("legacy-e2e-pec").get().getAudioStoragePath());
        pecs.save(pec);

        NoteEntity note = new NoteEntity();
        note.setPecId(pec.getId());
        note.setText("D6 publicado");
        note.setOriginalTimestamp(1.0);
        note.setLatitude(38.7);
        note.setLongitude(-9.1);
        context.getBean(NoteRepository.class).save(note);
        context.getBean(RallyReadGrantRepository.class).save(new RallyReadGrantEntity(reader, rally, true));

        NotebookPreferencesEntity preference = new NotebookPreferencesEntity();
        preference.setUserId(reader.getId());
        preference.setSettings("{\"version\":1,\"rules\":[],\"page\":{\"format\":\"A5\",\"orientation\":\"landscape\","
                + "\"marginMm\":10,\"rowsPerPage\":4,\"fontPt\":14,\"separators\":false,\"alignment\":\"right\"}}");
        context.getBean(NotebookPreferencesRepository.class).save(preference);
    }

    /** Explicit test manifest; no production data, startup migration hook or inferred owner. */
    static void migratedFixture(ApplicationContext context) throws Exception {
        org.example.entity.AuthUserEntity user=context.getBean(AuthUserRepository.class).findByEmailIgnoreCase("migrated@e2e.invalid").get();
        org.example.entity.RallyEntity rally=new org.example.entity.RallyEntity();rally.setName("Rali legado FEAT020");rally.setYear(2026);rally.setSurface("TERRA");rally.setLocation("Original");rally.setStatus("DRAFT");rally.setTeamProfileId(user.getTeamProfileId());rally=context.getBean(org.example.repository.RallyRepository.class).save(rally);
        org.example.entity.PecEntity pec=new org.example.entity.PecEntity("legacy-e2e-pec",1,"PEC legada FEAT020",2,1,"DRAFT",java.time.LocalDate.now(),rally);
        java.nio.file.Path media=java.nio.file.Paths.get(System.getProperty("recce.e2e.uploads"));
        byte[] wav=java.nio.ByteBuffer.allocate(60).order(java.nio.ByteOrder.LITTLE_ENDIAN)
            .put("RIFF".getBytes("US-ASCII")).putInt(52).put("WAVEfmt ".getBytes("US-ASCII")).putInt(16).putShort((short)1).putShort((short)1).putInt(8000).putInt(16000).putShort((short)2).putShort((short)16).put("data".getBytes("US-ASCII")).putInt(16).put(new byte[16]).array();
        java.nio.file.Path audio=media.resolve("legacy.wav");java.nio.file.Files.write(audio,wav);pec.setAudioFileName("legacy.wav");pec.setAudioContentType("audio/wav");pec.setAudioStoragePath(audio.toString());context.getBean(org.example.repository.PecRepository.class).save(pec);
        org.example.entity.NoteEntity note=new org.example.entity.NoteEntity();note.setPecId(pec.getId());note.setText("E3 legado");note.setOriginalTimestamp(1.0);context.getBean(org.example.repository.NoteRepository.class).save(note);
        java.nio.file.Path operation=java.nio.file.Files.createTempDirectory(media.getParent(),"migration-fixture-");
        com.fasterxml.jackson.databind.ObjectMapper json=context.getBean(com.fasterxml.jackson.databind.ObjectMapper.class);
        try(java.sql.Connection db=context.getBean(javax.sql.DataSource.class).getConnection()) {
            com.fasterxml.jackson.databind.JsonNode selected=null;for(com.fasterxml.jackson.databind.JsonNode entry:org.example.migration.LegacyCrewMigrationTool.plan(db,media).path("contexts"))if(entry.path("teamProfileId").asText().equals(user.getTeamProfileId()))selected=entry;
            if(selected==null)throw new IllegalStateException("Explicit legacy fixture context missing.");
            com.fasterxml.jackson.databind.node.ObjectNode manifest=json.createObjectNode().put("version",1).put("approvedBy","e2e-fixture").put("approvalReference","isolated-test-only");
            com.fasterxml.jackson.databind.node.ObjectNode entry=manifest.putArray("entries").addObject().put("teamProfileId",user.getTeamProfileId()).put("ownerAccountId",user.getId()).put("expectedDigest",selected.path("digest").asText());entry.putArray("legacyAccountIds").add(user.getId());
            java.nio.file.Path file=operation.resolve("manifest.json");java.nio.file.Files.write(file,json.writeValueAsBytes(manifest));
            org.example.migration.MigrationSnapshot.backup(db,media,operation.resolve("backup"));
            org.example.migration.MigrationSnapshot.restoreCheck(operation.resolve("backup"),operation.resolve("restore"),"sa","");
            org.example.migration.LegacyCrewMigrationTool.apply(db,media,file,org.example.migration.MigrationSnapshot.fileHash(file),operation.resolve("backup"),operation.resolve("restore/restore-proof.json"),"sa","",1);
        }
    }

    /** Only on this loopback, ephemeral, test-classpath server; never an email fallback. */
    static class Mailbox implements org.example.service.AccountMailer {
        final java.util.List<java.util.Map<String,String>> messages = new java.util.concurrent.CopyOnWriteArrayList<>();
        public boolean isConfigured() { return true; }
        public void send(String email, String purpose, String token) {
            java.util.Map<String,String> message = new java.util.HashMap<>(); message.put("email",email); message.put("purpose",purpose); message.put("token",token); messages.add(message);
        }
    }
}
