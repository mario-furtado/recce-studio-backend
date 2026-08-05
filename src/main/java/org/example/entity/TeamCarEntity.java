package org.example.entity;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "team_cars")
public class TeamCarEntity {
    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "car_class", nullable = false)
    private String carClass;

    private String notes;

    @Column(name = "active_car")
    private boolean active;

    private String photoFileName;
    private String photoContentType;
    private String photoStoragePath;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCarClass() { return carClass; }
    public void setCarClass(String carClass) { this.carClass = carClass; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public String getPhotoFileName() { return photoFileName; }
    public void setPhotoFileName(String photoFileName) { this.photoFileName = photoFileName; }

    public String getPhotoContentType() { return photoContentType; }
    public void setPhotoContentType(String photoContentType) { this.photoContentType = photoContentType; }

    public String getPhotoStoragePath() { return photoStoragePath; }
    public void setPhotoStoragePath(String photoStoragePath) { this.photoStoragePath = photoStoragePath; }
}
