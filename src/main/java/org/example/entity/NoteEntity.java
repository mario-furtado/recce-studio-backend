package org.example.entity;

import javax.persistence.*;
import lombok.*;

@Entity
@Table(name = "notes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NoteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String pecId;             // Identificador da PEC (ex: "pec-1", "lameirinha")
    private Double originalTimestamp; // Tempo em segundos
    private String text;              // Ex: "D4 fecha"
    private String speedRating;       // Ex: "3ª velocidade" / Obs
}