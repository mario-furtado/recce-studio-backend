package org.example.entity;

import lombok.Getter;

import javax.persistence.*;

@Entity
@Getter
@Table(name = "rally_access_events", indexes = @Index(name = "ix_rally_access_event", columnList = "rally_id,id"))
public class RallyAccessEventEntity {
    public enum Action { INVITED, ACCEPTED, DECLINED, CANCELLED, REVOKED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "rally_id", nullable = false, updatable = false)
    private String rallyId;
    @Column(nullable = false, updatable = false)
    private String actorId;
    @Column(updatable = false)
    private String recipientId;
    @Column(updatable = false)
    private String invitationId;
    @Column(updatable = false)
    private Long grantId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Action action;
    @Column(nullable = false, updatable = false)
    private long occurredAt;
    @Column(updatable = false)
    private String reason;

    protected RallyAccessEventEntity() {}

    private RallyAccessEventEntity(String rallyId, String actorId, String recipientId, String invitationId,
                                   Long grantId, Action action, long occurredAt, String reason) {
        this.rallyId = rallyId;
        this.actorId = actorId;
        this.recipientId = recipientId;
        this.invitationId = invitationId;
        this.grantId = grantId;
        this.action = action;
        this.occurredAt = occurredAt;
        this.reason = reason;
    }

    public static RallyAccessEventEntity invitation(RallyInvitationEntity invitation, String actor, Action action, long now) {
        return new RallyAccessEventEntity(invitation.getRally().getId(), actor, invitation.getRecipientId(),
                invitation.getId(), null, action, now, null);
    }

    public static RallyAccessEventEntity revocation(String rallyId, RallyReadGrantEntity grant, String actor, String reason, long now) {
        return new RallyAccessEventEntity(rallyId, actor, grant.getRecipientId(), grant.getSourceInvitationId(),
                grant.getId(), Action.REVOKED, now, reason);
    }
}
