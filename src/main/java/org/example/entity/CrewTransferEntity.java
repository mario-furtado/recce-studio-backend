package org.example.entity;

import javax.persistence.*;

@Entity
@Table(name = "crew_transfers", indexes = {
        @Index(name = "ix_crew_transfer_recipient", columnList = "recipient_id"),
        @Index(name = "ix_crew_transfer_crew", columnList = "crew_id")
})
public class CrewTransferEntity {
    @Id public String id;
    @Column(name = "crew_id", nullable = false, updatable = false) public String crewId;
    @Column(nullable = false, updatable = false) public String senderId;
    @Column(name = "recipient_id", nullable = false, updatable = false) public String recipientId;
    @Column(nullable = false, updatable = false) public long createdAt;
    @Column(nullable = false, updatable = false) public long expiresAt;
    @Column(updatable = false) public Long senderCredentialVersion;
    public Long acceptedAt;
    public Long cancelledAt;
}
