package org.example.controller;

import org.example.service.AuthService;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@Component
public class ApiAuthInterceptor implements HandlerInterceptor {
    private final AuthService authService;

    public ApiAuthInterceptor(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String authorization = request.getHeader("Authorization");
        String token = authorization != null && authorization.startsWith("Bearer ")
                ? authorization.substring("Bearer ".length()).trim()
                : null;

        if (authService.isTokenValid(token)) {
            return true;
        }

        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Sessao invalida ou expirada.");
        return false;
    }
}
