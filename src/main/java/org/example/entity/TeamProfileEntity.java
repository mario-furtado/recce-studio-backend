package org.example.entity;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "team_profile")
public class TeamProfileEntity {
    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String car;

    @Column(name = "car_class")
    private String carClass;

    private String selectedCarId;

    private String driverName;
    private String coDriverName;
    private String noteSystem;
    private String distanceUnit;
    private String logoFileName;
    private String logoContentType;
    private String logoStoragePath;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCar() { return car; }
    public void setCar(String car) { this.car = car; }

    public String getCarClass() { return carClass; }
    public void setCarClass(String carClass) { this.carClass = carClass; }

    public String getSelectedCarId() { return selectedCarId; }
    public void setSelectedCarId(String selectedCarId) { this.selectedCarId = selectedCarId; }

    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }

    public String getCoDriverName() { return coDriverName; }
    public void setCoDriverName(String coDriverName) { this.coDriverName = coDriverName; }

    public String getNoteSystem() { return noteSystem; }
    public void setNoteSystem(String noteSystem) { this.noteSystem = noteSystem; }

    public String getDistanceUnit() { return distanceUnit; }
    public void setDistanceUnit(String distanceUnit) { this.distanceUnit = distanceUnit; }

    public String getLogoFileName() { return logoFileName; }
    public void setLogoFileName(String logoFileName) { this.logoFileName = logoFileName; }

    public String getLogoContentType() { return logoContentType; }
    public void setLogoContentType(String logoContentType) { this.logoContentType = logoContentType; }

    public String getLogoStoragePath() { return logoStoragePath; }
    public void setLogoStoragePath(String logoStoragePath) { this.logoStoragePath = logoStoragePath; }
}
