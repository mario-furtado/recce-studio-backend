package org.example.dto;

public class TeamProfileDTO {
    private String id;
    private String name;
    private String car;
    private String carClass;
    private String selectedCarId;
    private String driverName;
    private String coDriverName;
    private String noteSystem;
    private String distanceUnit;
    private String logoFileName;
    private String logoUrl;
    private long totalPecs;
    private double totalKm;
    private long activeEvents;

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

    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }

    public long getTotalPecs() { return totalPecs; }
    public void setTotalPecs(long totalPecs) { this.totalPecs = totalPecs; }

    public double getTotalKm() { return totalKm; }
    public void setTotalKm(double totalKm) { this.totalKm = totalKm; }

    public long getActiveEvents() { return activeEvents; }
    public void setActiveEvents(long activeEvents) { this.activeEvents = activeEvents; }
}
