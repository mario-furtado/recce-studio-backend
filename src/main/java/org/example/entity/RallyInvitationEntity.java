package org.example.entity;

import lombok.Getter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import javax.persistence.*;
import java.util.UUID;

@Entity
@Getter
@Table(name = "rally_invitations", indexes = {
        @Index(name = "ix_invitation_address", columnList = "recipient_email"),
        @Index(name = "ix_invitation_sender", columnList = "rally_id,inviter_id")
})
public class RallyInvitationEntity {
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rally_id", nullable = false, updatable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private RallyEntity rally;

    @Column(name = "inviter_id", nullable = false, updatable = false)
    private String inviterId;

    @Column(nullable = false, updatable = false)
    private String crewName;

    @Column(name = "recipient_email", nullable = false, updatable = false, length = 254)
    private String recipientEmail;

    private String recipientId;
    @Column(nullable = false)
    private String state;
    @Column(nullable = false, updatable = false)
    private long createdAt;
    @Column(nullable = false, updatable = false)
    private long expiresAt;
    private Long decidedAt;
    private Long readAt;

    protected RallyInvitationEntity() {}

    public RallyInvitationEntity(RallyEntity rally, String inviterId, String crewName, String email, String recipientId, long now, long expiresAt) {
        this.id = UUID.randomUUID().toString();
        this.rally = rally;
        this.inviterId = inviterId;
        this.crewName = crewName;
        this.recipientEmail = email;
        this.recipientId = recipientId;
        this.createdAt = now;
        this.expiresAt = expiresAt;
        this.state = "PENDING";
    }

    public String stateAt(long now) {
        return "PENDING".equals(state) && expiresAt <= now ? "EXPIRED" : state;
    }

    public void markRead(String accountId, long now) {
        recipientId = accountId;
        if (readAt == null) readAt = now;
    }

    public void decide(String state, long now) {
        this.state = state;
        this.decidedAt = now;
    }
}
