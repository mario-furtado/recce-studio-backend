package org.example.entity;

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
}