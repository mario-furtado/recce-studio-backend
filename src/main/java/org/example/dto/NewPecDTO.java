package org.example.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true) // 👈 Impede erros 500 se o JSON trouxer campos extra
public class NewPecDTO {
    private Integer number;
    private String name;
    private Double distanceKm;
    private String status;
    private Integer totalNotes;

    public NewPecDTO() {}

    public Integer getNumber() { return number; }
    public void setNumber(Integer number) { this.number = number; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }

    public String getStatus() {
        return status != null ? status : "DRAFT";
    }
    public void setStatus(String status) { this.status = status; }

    public Integer totalNotes() { return number; }
    public void totalNotes(Integer number) { this.number = number; }
}