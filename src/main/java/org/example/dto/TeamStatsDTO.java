package org.example.dto;

public class TeamStatsDTO {
    private long totalPecs;
    private double totalKm;
    private long activeEvents;

    public TeamStatsDTO() {}

    public TeamStatsDTO(long totalPecs, double totalKm, long activeEvents) {
        this.totalPecs = totalPecs;
        this.totalKm = totalKm;
        this.activeEvents = activeEvents;
    }

    public long getTotalPecs() { return totalPecs; }
    public void setTotalPecs(long totalPecs) { this.totalPecs = totalPecs; }

    public double getTotalKm() { return totalKm; }
    public void setTotalKm(double totalKm) { this.totalKm = totalKm; }

    public long getActiveEvents() { return activeEvents; }
    public void setActiveEvents(long activeEvents) { this.activeEvents = activeEvents; }
}
