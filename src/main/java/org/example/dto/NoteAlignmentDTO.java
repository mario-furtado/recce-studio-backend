package org.example.dto;

public class NoteAlignmentDTO {
    private Double targetTimestamp;
    private String text;
    private String speedRating;
    private Boolean shiftFollowing;

    public Double getTargetTimestamp() {
        return targetTimestamp;
    }

    public void setTargetTimestamp(Double targetTimestamp) {
        this.targetTimestamp = targetTimestamp;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getSpeedRating() {
        return speedRating;
    }

    public void setSpeedRating(String speedRating) {
        this.speedRating = speedRating;
    }

    public Boolean getShiftFollowing() {
        return shiftFollowing;
    }

    public void setShiftFollowing(Boolean shiftFollowing) {
        this.shiftFollowing = shiftFollowing;
    }
}
