package org.example.e2e;

import org.example.Main;
import org.example.dto.AuthRequestDTO;
import org.example.service.AuthService;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** Test-classpath only: never included in the production jar or component scan. */
public final class E2eServer {
    public static void main(String[] args) {
        String password = System.getenv("RECCE_E2E_PASSWORD");
        if (password == null || password.length() < 32) {
            throw new IllegalArgumentException("An ephemeral E2E password is required.");
        }
        String uploads = System.getProperty("recce.e2e.uploads");
        if (uploads == null) throw new IllegalArgumentException("An isolated upload directory is required.");
        new SpringApplication(Main.class, Seed.class).run(
                "--server.address=127.0.0.1", "--server.port=18765",
                "--spring.datasource.url=jdbc:h2:mem:recce-e2e;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
                "--spring.datasource.username=sa", "--spring.datasource.password=",
                "--spring.jpa.hibernate.ddl-auto=create-drop", "--spring.jpa.show-sql=false",
                "--spring.h2.console.enabled=false", "--recce.environment=test",
                "--recce.test-user.enabled=false", "--recce.storage.type=local",
                "--recce.upload-dir=" + uploads, "--recce.auth.token-ttl-seconds=3600");
    }

    @TestConfiguration
    static class Seed {
        @Bean
        InitializingBean e2eAccounts(AuthService auth) {
            return () -> {
                for (String account : new String[]{"owner", "other"}) {
                    AuthRequestDTO request = new AuthRequestDTO();
                    request.setEmail(account + "@e2e.invalid");
                    request.setPassword(System.getenv("RECCE_E2E_PASSWORD"));
                    request.setTeamName("E2E " + account);
                    auth.register(request);
                }
            };
        }
    }
}
