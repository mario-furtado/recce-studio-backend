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

    @org.junit.jupiter.api.Test
    void crewAuthorizationDatabaseFailuresDoNotExposePersistenceDetails() {
        AuthService auth=mock(AuthService.class);
        org.example.service.CrewService crews=mock(org.example.service.CrewService.class);
        org.example.entity.AuthUserEntity user=new org.example.entity.AuthUserEntity(); user.setId("account"); user.setEmail("account@example.invalid");
        when(auth.findActiveUserByToken("token")).thenReturn(java.util.Optional.of(user)); when(auth.isTokenValid("token")).thenReturn(true);
        when(crews.requireOwned("account","crew")).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("SQL connection secret"));
        org.springframework.mock.web.MockHttpServletRequest request=new org.springframework.mock.web.MockHttpServletRequest("GET","/api/rallies"); request.addHeader("Authorization","Bearer token"); request.addHeader("X-Crew-Id","crew");
        org.example.service.AccountFlowException error=org.junit.jupiter.api.Assertions.assertThrows(org.example.service.AccountFlowException.class,
            () -> new ApiAuthInterceptor(auth,crews).preHandle(request,new org.springframework.mock.web.MockHttpServletResponse(),new Object()));
        org.junit.jupiter.api.Assertions.assertEquals(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,error.status);
        assertFalse(error.getMessage().contains("secret"));
    }

    @ParameterizedTest
    @CsvSource({"GET,audio", "GET,video", "HEAD,audio", "HEAD,video"})
    void auditSec002RequiresAuthenticationForRecceMedia(String method, String media) throws Exception {
        AuthService authService = mock(AuthService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(request.getMethod()).thenReturn(method);
        when(request.getRequestURI()).thenReturn("/api/pecs/pec-audit/" + media);
        when(request.getContextPath()).thenReturn("");

        boolean allowed = new ApiAuthInterceptor(authService, mock(org.example.service.CrewService.class))
                .preHandle(request, response, new Object());

        assertFalse(allowed, "A recce recording must not be downloadable anonymously");
        verify(response).sendError(HttpServletResponse.SC_UNAUTHORIZED, "Sessao invalida ou expirada.");
    }
}
