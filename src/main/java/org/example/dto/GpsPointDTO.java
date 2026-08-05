package org.example.dto;

public class GpsPointDTO {
    private double lat;
    private double lng;
    private Double speedKmh;
    private Double timestamp;

    public GpsPointDTO() {}

    public GpsPointDTO(double lat, double lng, Double speedKmh, Double timestamp) {
        this.lat = lat;
        this.lng = lng;
        this.speedKmh = speedKmh;
        this.timestamp = timestamp;
    }

    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }

    public double getLng() { return lng; }
    public void setLng(double lng) { this.lng = lng; }

    public Double getSpeedKmh() { return speedKmh; }
    public void setSpeedKmh(Double speedKmh) { this.speedKmh = speedKmh; }

    public Double getTimestamp() { return timestamp; }
    public void setTimestamp(Double timestamp) { this.timestamp = timestamp; }
}
