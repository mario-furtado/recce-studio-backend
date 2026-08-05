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

    @Column(name = "video_file_name")
    private String videoFileName;

    @Column(name = "video_content_type")
    private String videoContentType;

    @Column(name = "video_storage_path")
    private String videoStoragePath;

    @Column(name = "gps_file_name")
    private String gpsFileName;

    @Column(name = "gps_content_type")
    private String gpsContentType;

    @Column(name = "gps_storage_path")
    private String gpsStoragePath;

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

    public String getVideoFileName() { return videoFileName; }
    public void setVideoFileName(String videoFileName) { this.videoFileName = videoFileName; }

    public String getVideoContentType() { return videoContentType; }
    public void setVideoContentType(String videoContentType) { this.videoContentType = videoContentType; }

    public String getVideoStoragePath() { return videoStoragePath; }
    public void setVideoStoragePath(String videoStoragePath) { this.videoStoragePath = videoStoragePath; }

    public String getGpsFileName() { return gpsFileName; }
    public void setGpsFileName(String gpsFileName) { this.gpsFileName = gpsFileName; }

    public String getGpsContentType() { return gpsContentType; }
    public void setGpsContentType(String gpsContentType) { this.gpsContentType = gpsContentType; }

    public String getGpsStoragePath() { return gpsStoragePath; }
    public void setGpsStoragePath(String gpsStoragePath) { this.gpsStoragePath = gpsStoragePath; }

    // CORRIGIDO: Nomes dos getters/setters ajustados para bater certo com a propriedade 'rally'
    public RallyEntity getRally() { return rally; }
    public void setRally(RallyEntity rally) { this.rally = rally; }
}
