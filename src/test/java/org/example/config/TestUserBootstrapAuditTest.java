package org.example.config;

import org.example.dto.TeamProfileDTO;
import org.example.entity.AuthUserEntity;
import org.example.repository.AuthUserRepository;
import org.example.service.TeamProfileService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.support.ResourcePropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.FileSystemResource;
import org.springframework.security.crypto.bcrypt.BCrypt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TestUserBootstrapAuditTest {
    private ApplicationContextRunner runner() {
        final ResourcePropertySource defaults;
        try {
            defaults = new ResourcePropertySource(new FileSystemResource("src/main/resources/application.properties"));
        } catch (java.io.IOException exception) {
            throw new java.io.UncheckedIOException(exception);
        }
        return new ApplicationContextRunner()
                .withInitializer(context -> {
                    context.getEnvironment().getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
                    context.getEnvironment().getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
                    context.getEnvironment().getPropertySources().addLast(defaults);
                })
                .withUserConfiguration(BootstrapConfig.class);
    }

    @Test
    void auditSec005IsDisabledByDefault() {
        runner().run(context -> {
            assertFalse(context.getEnvironment().getProperty("recce.test-user.enabled", Boolean.class));
            context.getBean(TestUserBootstrap.class).run();
            verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"production", "staging", "unknown"})
    void auditSec005ExplicitDisableDoesNotAccessPersistence(String environment) {
        runner().withPropertyValues("recce.environment=" + environment, "RECCE_TEST_USER_ENABLED=false")
                .run(context -> {
                    context.getBean(TestUserBootstrap.class).run();
                    verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"production", "prod", "staging", "stage", "preview", "production-eu", "unknown"})
    void auditSec005MissingFlagDoesNotProvisionInDeploymentEnvironments(String environment) {
        runner().withPropertyValues("recce.environment=" + environment).run(context -> {
            context.getBean(TestUserBootstrap.class).run();
            verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"production", "prod", "staging", "stage", "preview", "production-eu", "unknown"})
    void auditSec005ExplicitEnableFailsClosedOutsideLocalEnvironments(String environment) {
        runner().withPropertyValues("recce.environment=" + environment, "recce.test-user.enabled=true",
                "server.address=127.0.0.1", "recce.test-user.email=fixture@example.test",
                "recce.test-user.password=local-fixture-password").run(context -> {
            assertThrows(IllegalStateException.class, () -> context.getBean(TestUserBootstrap.class).run());
            verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"0.0.0.0", "::", "192.0.2.1", ""})
    void auditSec005ExplicitEnableRequiresLoopbackBinding(String address) {
        runner().withPropertyValues("recce.environment=dev", "recce.test-user.enabled=true",
                "server.address=" + address, "recce.test-user.email=fixture@example.test",
                "recce.test-user.password=local-fixture-password").run(context -> {
            assertThrows(IllegalStateException.class, () -> context.getBean(TestUserBootstrap.class).run());
            verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
        });
    }

    @Test
    void auditSec005OptInDoesNotSupplyDefaultCredentials() {
        runner().withPropertyValues("recce.environment=local", "recce.test-user.enabled=true", "server.address=127.0.0.1")
                .run(context -> {
                    assertThrows(IllegalStateException.class, () -> context.getBean(TestUserBootstrap.class).run());
                    verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
                });
    }

    @ParameterizedTest
    @CsvSource({"'',local-fixture-password", "fixture@example.test,''", "fixture@example.test,short"})
    void auditSec005RejectsMissingOrInvalidCredentialsBeforePersistence(String email, String password) {
        runner().withPropertyValues("recce.environment=local", "recce.test-user.enabled=true", "server.address=127.0.0.1",
                "recce.test-user.email=" + email, "recce.test-user.password=" + password).run(context -> {
            assertThrows(IllegalStateException.class, () -> context.getBean(TestUserBootstrap.class).run());
            verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
        });
    }

    @Test
    void auditSec005InvalidEnableFlagFailsDuringBinding() {
        runner().withPropertyValues("RECCE_TEST_USER_ENABLED=invalid").run(context -> {
            assertNotNull(context.getStartupFailure());
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"production", "staging", "dev"})
    void auditSec005RailwayEnvironmentCannotBeOverriddenByLocalLabel(String environment) {
        runner().withPropertyValues("recce.environment=local", "RAILWAY_ENVIRONMENT_NAME=" + environment,
                "RECCE_TEST_USER_ENABLED=true", "server.address=127.0.0.1",
                "recce.test-user.email=fixture@example.test", "recce.test-user.password=local-fixture-password")
                .run(context -> {
                    assertThrows(IllegalStateException.class, () -> context.getBean(TestUserBootstrap.class).run());
                    verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"production", "staging", "prod-eu"})
    void auditSec005ActiveProfilesCannotBeHiddenByLocalLabel(String profile) {
        runner().withInitializer(context -> context.getEnvironment().setActiveProfiles("local", profile))
                .withPropertyValues("recce.environment=local", "RECCE_TEST_USER_ENABLED=true", "server.address=127.0.0.1",
                        "recce.test-user.email=fixture@example.test", "recce.test-user.password=local-fixture-password")
                .run(context -> {
                    assertThrows(IllegalStateException.class, () -> context.getBean(TestUserBootstrap.class).run());
                    verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
                });
    }

    @Test
    void auditSec005ProductionDefaultProfileIsAlsoRejected() {
        runner().withInitializer(context -> context.getEnvironment().setDefaultProfiles("production"))
                .withPropertyValues("recce.environment=local", "RECCE_TEST_USER_ENABLED=true", "server.address=127.0.0.1",
                        "recce.test-user.email=fixture@example.test", "recce.test-user.password=local-fixture-password")
                .run(context -> {
                    assertThrows(IllegalStateException.class, () -> context.getBean(TestUserBootstrap.class).run());
                    verifyNoInteractions(context.getBean(AuthUserRepository.class), context.getBean(TeamProfileService.class));
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"localhost", "::1", "0:0:0:0:0:0:0:1"})
    void auditSec005OtherSupportedLoopbackBindingsWork(String address) {
        runner().withPropertyValues("recce.environment=test", "recce.test-user.enabled=true", "server.address=" + address,
                "recce.test-user.email=fixture@example.test", "recce.test-user.password=local-fixture-password")
                .run(context -> {
                    context.getBean(TestUserBootstrap.class).run();
                    verify(context.getBean(AuthUserRepository.class)).save(org.mockito.ArgumentMatchers.any(AuthUserEntity.class));
                });
    }

    @Test
    void auditSec005ExplicitLocalOptInStillCreatesHashedCredentials() {
        runner().withPropertyValues("recce.environment=local", "RECCE_TEST_USER_ENABLED=true", "server.address=127.0.0.1",
                "RECCE_TEST_USER_EMAIL= Fixture@Example.Test ", "RECCE_TEST_USER_PASSWORD=local-fixture-password")
                .run(context -> {
                    context.getBean(TestUserBootstrap.class).run();
                    ArgumentCaptor<AuthUserEntity> saved = ArgumentCaptor.forClass(AuthUserEntity.class);
                    verify(context.getBean(AuthUserRepository.class)).save(saved.capture());
                    AuthUserEntity user = saved.getValue();
                    assertEquals("fixture@example.test", user.getEmail());
                    assertEquals("default", user.getTeamProfileId());
                    assertTrue(user.isActive());
                    assertNotNull(user.getToken());
                    assertEquals(64, user.getToken().length());
                    assertTrue(BCrypt.checkpw("local-fixture-password", user.getPasswordHash()));
                });
    }

    @TestConfiguration(proxyBeanMethods = false)
    @Import(TestUserBootstrap.class)
    static class BootstrapConfig {
        @Bean
        AuthUserRepository users() {
            return mock(AuthUserRepository.class);
        }

        @Bean
        TeamProfileService profiles() {
            TeamProfileService service = mock(TeamProfileService.class);
            TeamProfileDTO profile = new TeamProfileDTO();
            profile.setId("default");
            when(service.getProfile("default")).thenReturn(profile);
            return service;
        }
    }
}
