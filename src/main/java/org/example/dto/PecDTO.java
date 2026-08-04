package org.example.dto;

import java.time.LocalDate;

public class PecDTO {
    private String id;
    private int number;
    private String name;
    private double distanceKm;
    private int totalNotes;
    private String status;
    private String updatedAt;
    private String rallyId;

    public PecDTO() {}

    // Getters e Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public int getNumber() { return number; }
    public void setNumber(int number) { this.number = number; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(double distanceKm) { this.distanceKm = distanceKm; }

    public int getTotalNotes() { return totalNotes; }
    public void setTotalNotes(int totalNotes) { this.totalNotes = totalNotes; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }

    public String getRallyId() { return rallyId; }
    public void setRallyId(String rallyId) { this.rallyId = rallyId; }
}

