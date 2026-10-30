package org.example.entity;

import javax.persistence.*;

@Entity
@Table(name = "reccebook_templates")
public class RecceBookTemplateEntity {
    @Id private String userId;
    @Lob @Column(nullable = false) private String cover;
    public String getUserId() { return userId; }
    public void setUserId(String value) { userId = value; }
    public String getCover() { return cover; }
    public void setCover(String value) { cover = value; }
}
