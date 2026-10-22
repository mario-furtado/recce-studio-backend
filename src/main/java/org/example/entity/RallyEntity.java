package org.example.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import javax.persistence.*;

@Entity
@Table(name = "rallies")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RallyEntity {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(
            name = "UUID",
            strategy = "org.hibernate.id.UUIDGenerator"
    )
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "rally_year", nullable = false)
    private int year;

    @Column(nullable = false)
    private String surface; // TERRA, ASFALTO, NEVE, MISTO

    @Column(nullable = false)
    private String location;

    private String icon;

    private String logoFileName;

    private String logoContentType;

    private String logoStoragePath;

    private String carId;

    private String carClass;

    private String status;

    @Column(name = "team_profile_id")
    @JsonIgnore
    private String teamProfileId;

    @Transient
    private long pecsCount;
}
