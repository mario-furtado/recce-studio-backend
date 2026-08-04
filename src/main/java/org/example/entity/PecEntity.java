package org.example.entity;

import javax.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "pecs")
public class PecEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private int number;

    @Column(nullable = false)
    private String name;

    @Column(name = "distance_km", nullable = false)
    private double distanceKm;

    @Column(name = "total_notes", nullable = false)
    private int totalNotes;

    @Column(nullable = false)
    private String status;

    @Column(name = "updated_at")
    private LocalDate updatedAt;

    // Relacionamento com o Rally
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rally_id", nullable = false)
    private RallyEntity rally;

    public PecEntity() {}

    public PecEntity(String id, int number, String name, double distanceKm, int totalNotes, String status, LocalDate updatedAt, RallyEntity rally) {
        this.id = id;
        this.number = number;
        this.name = name;
        this.distanceKm = distanceKm;
        this.totalNotes = totalNotes;
        this.status = status;
        this.updatedAt = updatedAt;
        this.rally = rally;
    }

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

    public LocalDate getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDate updatedAt) { this.updatedAt = updatedAt; }

    // CORRIGIDO: Nomes dos getters/setters ajustados para bater certo com a propriedade 'rally'
    public RallyEntity getRally() { return rally; }
    public void setRally(RallyEntity rally) { this.rally = rally; }
}