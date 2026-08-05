package org.example.dto;

public class PecOverviewDTO {
    private String id;
    private String name;
    private String status;
    private Double distanceKm;
    private String surface;
    private long notesCount; // Adicionamos a contagem aqui!

    // Construtores, Getters e Setters
    public PecOverviewDTO() {}

    public PecOverviewDTO(String id, String name, String status, Double distanceKm, String surface, long notesCount) {
        this.id = id;
        this.name = name;
        this.status = status;
        this.distanceKm = distanceKm;
        this.surface = surface;
        this.notesCount = notesCount;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setDistanceKm(Double distanceKm) {
        this.distanceKm = distanceKm;
    }

    public void setSurface(String surface) {
        this.surface = surface;
    }

    public void setNotesCount(long notesCount) {
        this.notesCount = notesCount;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getStatus() {
        return status;
    }

    public Double getDistanceKm() {
        return distanceKm;
    }

    public String getSurface() {
        return surface;
    }

    public long getNotesCount() {
        return notesCount;
    }
}