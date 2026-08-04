package org.example.dto;

public class PecPatchDTO {
    private String name;
    private Double distanceKm;
    private Integer totalNotes;
    private String status;

    public PecPatchDTO() {}

    // Getters e Setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }

    public Integer getTotalNotes() { return totalNotes; }
    public void setTotalNotes(Integer totalNotes) { this.totalNotes = totalNotes; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}