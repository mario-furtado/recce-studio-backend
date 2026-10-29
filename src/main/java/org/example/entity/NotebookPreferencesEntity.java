package org.example.entity;

import javax.persistence.*;

@Entity
@Table(name = "notebook_preferences")
public class NotebookPreferencesEntity {
    @Id
    private String userId;
    @Lob
    @Column(nullable = false)
    private String settings;

    public String getUserId() { return userId; }
    public void setUserId(String value) { userId = value; }
    public String getSettings() { return settings; }
    public void setSettings(String value) { settings = value; }
}
