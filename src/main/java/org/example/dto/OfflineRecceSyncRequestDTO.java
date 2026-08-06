package org.example.dto;

import java.util.List;

public class OfflineRecceSyncRequestDTO {
    private String sessionId;
    private String deviceId;
    private String userEmail;
    private String temporaryName;
    private String pecId;
    private String rallyId;
    private NewPecDTO newPec;
    private String createdAt;
    private String finishedAt;
    private Integer notesCount;
    private Double durationSeconds;
    private List<ClickMarkerDto> markers;
    private List<GpsPointDTO> gpsTrack;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getTemporaryName() { return temporaryName; }
    public void setTemporaryName(String temporaryName) { this.temporaryName = temporaryName; }

    public String getPecId() { return pecId; }
    public void setPecId(String pecId) { this.pecId = pecId; }

    public String getRallyId() { return rallyId; }
    public void setRallyId(String rallyId) { this.rallyId = rallyId; }

    public NewPecDTO getNewPec() { return newPec; }
    public void setNewPec(NewPecDTO newPec) { this.newPec = newPec; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getFinishedAt() { return finishedAt; }
    public void setFinishedAt(String finishedAt) { this.finishedAt = finishedAt; }

    public Integer getNotesCount() { return notesCount; }
    public void setNotesCount(Integer notesCount) { this.notesCount = notesCount; }

    public Double getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Double durationSeconds) { this.durationSeconds = durationSeconds; }

    public List<ClickMarkerDto> getMarkers() { return markers; }
    public void setMarkers(List<ClickMarkerDto> markers) { this.markers = markers; }

    public List<GpsPointDTO> getGpsTrack() { return gpsTrack; }
    public void setGpsTrack(List<GpsPointDTO> gpsTrack) { this.gpsTrack = gpsTrack; }
}
