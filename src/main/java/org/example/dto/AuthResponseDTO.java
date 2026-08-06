package org.example.dto;

public class AuthResponseDTO {
    private String token;
    private String email;
    private TeamProfileDTO profile;

    public AuthResponseDTO() {}

    public AuthResponseDTO(String token, String email, TeamProfileDTO profile) {
        this.token = token;
        this.email = email;
        this.profile = profile;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public TeamProfileDTO getProfile() { return profile; }
    public void setProfile(TeamProfileDTO profile) { this.profile = profile; }
}
