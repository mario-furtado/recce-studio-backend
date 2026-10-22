package org.example.controller;

import org.example.service.AuthService;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApiAuthInterceptorAuditTest {

    @ParameterizedTest
    @CsvSource({"GET,audio", "GET,video", "HEAD,audio", "HEAD,video"})
    void auditSec002RequiresAuthenticationForRecceMedia(String method, String media) throws Exception {
        AuthService authService = mock(AuthService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(request.getMethod()).thenReturn(method);
        when(request.getRequestURI()).thenReturn("/api/pecs/pec-audit/" + media);
        when(request.getContextPath()).thenReturn("");

        boolean allowed = new ApiAuthInterceptor(authService)
                .preHandle(request, response, new Object());

        assertFalse(allowed, "A recce recording must not be downloadable anonymously");
        verify(response).sendError(HttpServletResponse.SC_UNAUTHORIZED, "Sessao invalida ou expirada.");
    }
}
