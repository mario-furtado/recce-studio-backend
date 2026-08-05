package org.example.dto;

public class PecAssetDTO {
    private boolean hasVideo;
    private String videoFileName;
    private String videoUrl;
    private boolean hasGps;
    private String gpsFileName;
    private String gpsUrl;

    public boolean isHasVideo() { return hasVideo; }
    public void setHasVideo(boolean hasVideo) { this.hasVideo = hasVideo; }

    public String getVideoFileName() { return videoFileName; }
    public void setVideoFileName(String videoFileName) { this.videoFileName = videoFileName; }

    public String getVideoUrl() { return videoUrl; }
    public void setVideoUrl(String videoUrl) { this.videoUrl = videoUrl; }

    public boolean isHasGps() { return hasGps; }
    public void setHasGps(boolean hasGps) { this.hasGps = hasGps; }

    public String getGpsFileName() { return gpsFileName; }
    public void setGpsFileName(String gpsFileName) { this.gpsFileName = gpsFileName; }

    public String getGpsUrl() { return gpsUrl; }
    public void setGpsUrl(String gpsUrl) { this.gpsUrl = gpsUrl; }
}
