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
    private final org.example.service.CrewService crews;

    public ApiAuthInterceptor(AuthService authService, org.example.service.CrewService crews) {
        this.authService = authService;
        this.crews = crews;
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
            request.setAttribute(TenantContext.ACCOUNT_ID_ATTRIBUTE, user.getId());
            request.setAttribute(TenantContext.USER_EMAIL_ATTRIBUTE, user.getEmail());
            Class<?> controller=handler instanceof org.springframework.web.method.HandlerMethod
                ? ((org.springframework.web.method.HandlerMethod)handler).getBeanType() : null;
            if (controller!=null && CrewController.class.isAssignableFrom(controller)) {
                if (!authService.isTokenValid(token)) { response.sendError(401); return false; }
                return true;
            }
            java.util.List<String> contexts=java.util.Collections.list(request.getHeaders("X-Crew-Id"));
            if (!contexts.isEmpty()) {
                if (!authService.isTokenValid(token)) { response.sendError(401); return false; }
                if (contexts.size()!=1 || contexts.get(0).trim().isEmpty() || contexts.get(0).length()>64) throw new IllegalArgumentException("Contexto de tripulação inválido.");
                org.example.entity.CrewEntity crew;
                try { crew=crews.requireOwned(user.getId(),contexts.get(0).trim()); }
                catch (org.springframework.dao.DataAccessException ex) { throw new org.example.service.AccountFlowException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Não foi possível validar a tripulação. Tenta novamente."); }
                // Use the mapped handler, not the raw URL: Spring accepts matrix parameters.
                if (controller!=null && OfflineRecceSyncController.class.isAssignableFrom(controller)) throw new org.example.service.AccountFlowException(org.springframework.http.HttpStatus.FORBIDDEN,"A sincronização offline de novas tripulações ainda não está disponível.");
                request.setAttribute(TenantContext.TEAM_PROFILE_ID_ATTRIBUTE,crew.id);
                response.setHeader("Cache-Control","no-store");
                return true;
            }
            String legacyWorkspace=authService.getWorkspaceTeamProfileId(user);
            if (!StringUtils.hasText(legacyWorkspace)) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "A conta autenticada nao tem equipa associada.");
                return false;
            }
            request.setAttribute(TenantContext.TEAM_PROFILE_ID_ATTRIBUTE, legacyWorkspace);
            request.setAttribute(TenantContext.USER_EMAIL_ATTRIBUTE, user.getEmail());
            return true;
        }

        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Sessao invalida ou expirada.");
        return false;
    }

}
