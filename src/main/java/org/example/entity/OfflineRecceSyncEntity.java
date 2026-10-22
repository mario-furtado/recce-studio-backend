package org.example.entity;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;
import java.time.LocalDateTime;

@Entity
@Table(name = "offline_recce_syncs", uniqueConstraints = {
        @UniqueConstraint(name = "uk_offline_session_team", columnNames = {"offline_session_id", "team_profile_id"})
})
public class OfflineRecceSyncEntity {
    @Id
    private String id;

    @Column(name = "offline_session_id", nullable = false)
    private String offlineSessionId;

    @Column(name = "device_id")
    private String deviceId;

    @Column(name = "user_email")
    private String userEmail;

    @Column(name = "temporary_name")
    private String temporaryName;

    @Column(name = "pec_id", nullable = false)
    private String pecId;

    @Column(name = "pec_name")
    private String pecName;

    @Column(name = "created_at_client")
    private String createdAtClient;

    @Column(name = "finished_at_client")
    private String finishedAtClient;

    @Column(name = "notes_count", nullable = false)
    private int notesCount;

    @Column(name = "duration_seconds", nullable = false)
    private double durationSeconds;

    @Column(name = "markers_json", columnDefinition = "TEXT")
    private String markersJson;

    @Column(name = "gps_track_json", columnDefinition = "TEXT")
    private String gpsTrackJson;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;

    @Column(name = "team_profile_id")
    private String teamProfileId;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getOfflineSessionId() { return offlineSessionId; }
    public void setOfflineSessionId(String offlineSessionId) { this.offlineSessionId = offlineSessionId; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getTemporaryName() { return temporaryName; }
    public void setTemporaryName(String temporaryName) { this.temporaryName = temporaryName; }

    public String getPecId() { return pecId; }
    public void setPecId(String pecId) { this.pecId = pecId; }

    public String getPecName() { return pecName; }
    public void setPecName(String pecName) { this.pecName = pecName; }

    public String getCreatedAtClient() { return createdAtClient; }
    public void setCreatedAtClient(String createdAtClient) { this.createdAtClient = createdAtClient; }

    public String getFinishedAtClient() { return finishedAtClient; }
    public void setFinishedAtClient(String finishedAtClient) { this.finishedAtClient = finishedAtClient; }

    public int getNotesCount() { return notesCount; }
    public void setNotesCount(int notesCount) { this.notesCount = notesCount; }

    public double getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(double durationSeconds) { this.durationSeconds = durationSeconds; }

    public String getMarkersJson() { return markersJson; }
    public void setMarkersJson(String markersJson) { this.markersJson = markersJson; }

    public String getGpsTrackJson() { return gpsTrackJson; }
    public void setGpsTrackJson(String gpsTrackJson) { this.gpsTrackJson = gpsTrackJson; }

    public LocalDateTime getSyncedAt() { return syncedAt; }
    public void setSyncedAt(LocalDateTime syncedAt) { this.syncedAt = syncedAt; }

    public String getTeamProfileId() { return teamProfileId; }
    public void setTeamProfileId(String teamProfileId) { this.teamProfileId = teamProfileId; }
}
