package org.example.controller;

import org.example.service.AuthService;
import org.example.entity.AuthUserEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.Optional;

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

        Optional<AuthUserEntity> authenticatedUser = authService.findActiveUserByToken(token);
        if (authenticatedUser.isPresent()) {
            AuthUserEntity user = authenticatedUser.get();
            if (!StringUtils.hasText(user.getTeamProfileId())) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "A conta autenticada nao tem equipa associada.");
                return false;
            }
            request.setAttribute(TenantContext.TEAM_PROFILE_ID_ATTRIBUTE, user.getTeamProfileId());
            request.setAttribute(TenantContext.USER_EMAIL_ATTRIBUTE, user.getEmail());
            return true;
        }

        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Sessao invalida ou expirada.");
        return false;
    }

}
