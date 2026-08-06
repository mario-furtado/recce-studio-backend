package org.example.dto;

public class AuthRequestDTO {
    private String email;
    private String password;
    private String teamName;
    private String driverName;
    private String coDriverName;
    private String noteSystem;
    private String distanceUnit;

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getTeamName() { return teamName; }
    public void setTeamName(String teamName) { this.teamName = teamName; }

    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }

    public String getCoDriverName() { return coDriverName; }
    public void setCoDriverName(String coDriverName) { this.coDriverName = coDriverName; }

    public String getNoteSystem() { return noteSystem; }
    public void setNoteSystem(String noteSystem) { this.noteSystem = noteSystem; }

    public String getDistanceUnit() { return distanceUnit; }
    public void setDistanceUnit(String distanceUnit) { this.distanceUnit = distanceUnit; }
}
