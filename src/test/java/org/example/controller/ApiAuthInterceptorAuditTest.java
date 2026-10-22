package org.example.controller;

import org.example.service.AuthService;
import org.junit.jupiter.api.Test;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApiAuthInterceptorAuditTest {

    @Test
    void auditSec002RequiresAuthenticationForRecceAudio() throws Exception {
        AuthService authService = mock(AuthService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(request.getMethod()).thenReturn("GET");
        when(request.getRequestURI()).thenReturn("/api/pecs/pec-audit/audio");
        when(request.getContextPath()).thenReturn("");

        boolean allowed = new ApiAuthInterceptor(authService)
                .preHandle(request, response, new Object());

        assertFalse(allowed, "A recce recording must not be downloadable anonymously");
        verify(response).sendError(HttpServletResponse.SC_UNAUTHORIZED, "Sessao invalida ou expirada.");
    }
}
