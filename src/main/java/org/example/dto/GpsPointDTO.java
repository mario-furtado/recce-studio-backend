package org.example.dto;

public class GpsPointDTO {
    private Double lat;
    private Double lng;
    private Double speedKmh;
    private Double timestamp;
    private Double accuracy;
    private Integer segment;

    public Integer getSegment() { return segment; }
    public void setSegment(Integer segment) { this.segment = segment; }

    public GpsPointDTO() {}

    public GpsPointDTO(double lat, double lng, Double speedKmh, Double timestamp) {
        this.lat = lat;
        this.lng = lng;
        this.speedKmh = speedKmh;
        this.timestamp = timestamp;
    }

    public Double getLat() { return lat; }
    public void setLat(Double lat) { this.lat = lat; }

    public Double getLng() { return lng; }
    public void setLng(Double lng) { this.lng = lng; }

    public Double getSpeedKmh() { return speedKmh; }
    public void setSpeedKmh(Double speedKmh) { this.speedKmh = speedKmh; }

    public Double getTimestamp() { return timestamp; }
    public void setTimestamp(Double timestamp) { this.timestamp = timestamp; }

    public Double getAccuracy() { return accuracy; }
    public void setAccuracy(Double accuracy) { this.accuracy = accuracy; }
}
