package org.example.entity;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import javax.persistence.*;

@Entity
@Table(name = "book_publications")
public class BookPublicationEntity {
    @Id
    @Column(name = "pec_id")
    private String pecId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pec_id", insertable = false, updatable = false, nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private PecEntity pec;

    @Column(nullable = false)
    private long revision;

    @Lob
    @Column(nullable = false)
    private String snapshot;

    protected BookPublicationEntity() {}

    public BookPublicationEntity(PecEntity pec) {
        this.pec = pec;
        this.pecId = pec.getId();
    }

    public long getRevision() { return revision; }

    public String getSnapshot() { return snapshot; }

    public void publish(String snapshot) {
        this.snapshot = snapshot;
        revision++;
    }
}
