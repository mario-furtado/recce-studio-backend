package org.example.controller;

import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;

@Component
public class TenantContext {
    public static final String TEAM_PROFILE_ID_ATTRIBUTE = "recce.auth.teamProfileId";
    public static final String USER_EMAIL_ATTRIBUTE = "recce.auth.userEmail";

    private final HttpServletRequest request;

    public TenantContext(HttpServletRequest request) {
        this.request = request;
    }

    public String requireTeamProfileId() {
        return requireAttribute(TEAM_PROFILE_ID_ATTRIBUTE, "A conta autenticada nao tem equipa associada.");
    }

    public String requireUserEmail() {
        return requireAttribute(USER_EMAIL_ATTRIBUTE, "A conta autenticada nao tem email associado.");
    }

    private String requireAttribute(String name, String message) {
        Object value = request.getAttribute(name);
        if (!(value instanceof String) || ((String) value).trim().isEmpty()) {
            throw new IllegalStateException(message);
        }
        return ((String) value).trim();
    }
}
