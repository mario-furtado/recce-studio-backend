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

        if ("GET".equalsIgnoreCase(request.getMethod()) && isPublicMediaPath(request)) {
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

    private boolean isPublicMediaPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && path.startsWith(contextPath)) {
            path = path.substring(contextPath.length());
        }

        return "/api/team-profile/logo".equals(path)
                || path.matches("^/api/team-profile/cars/[^/]+/photo$")
                || path.matches("^/api/rallies/[^/]+/logo$")
                || path.matches("^/api/pecs/[^/]+/video$")
                || path.matches("^/api/pecs/[^/]+/audio$");
    }
}
