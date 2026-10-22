package org.example.service;

import org.example.repository.AuthUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Clock;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class AuthTokenSettingsAuditTest {
    @ParameterizedTest
    @ValueSource(longs = {0, -1})
    void auditSec006NonPositiveLifetimeFailsClosed(long seconds) {
        assertThrows(IllegalArgumentException.class, () -> new AuthService(
                mock(AuthUserRepository.class), mock(TeamProfileService.class), Clock.systemUTC(), seconds));
    }

    @Test
    void auditSec006OverflowingLifetimeFailsClosed() {
        assertThrows(ArithmeticException.class, () -> new AuthService(
                mock(AuthUserRepository.class), mock(TeamProfileService.class), Clock.systemUTC(), Long.MAX_VALUE));
    }
}
