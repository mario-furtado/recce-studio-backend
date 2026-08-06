package org.example.dto;

public class OfflineRecceSyncResponseDTO {
    private String syncId;
    private String offlineSessionId;
    private String pecId;
    private String pecName;
    private int notesCount;
    private String syncedAt;

    public String getSyncId() { return syncId; }
    public void setSyncId(String syncId) { this.syncId = syncId; }

    public String getOfflineSessionId() { return offlineSessionId; }
    public void setOfflineSessionId(String offlineSessionId) { this.offlineSessionId = offlineSessionId; }

    public String getPecId() { return pecId; }
    public void setPecId(String pecId) { this.pecId = pecId; }

    public String getPecName() { return pecName; }
    public void setPecName(String pecName) { this.pecName = pecName; }

    public int getNotesCount() { return notesCount; }
    public void setNotesCount(int notesCount) { this.notesCount = notesCount; }

    public String getSyncedAt() { return syncedAt; }
    public void setSyncedAt(String syncedAt) { this.syncedAt = syncedAt; }
}
