package org.example.dto;

import lombok.Data;

@Data
public class ClickMarkerDto {
    private int index;
    private Double timestamp;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Double speed;
    private String text;
    private String rawText;
    private String speedRating;
    private String source;
    private Double audioConfidence;
}
