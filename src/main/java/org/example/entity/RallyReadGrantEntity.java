package org.example.entity;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import javax.persistence.*;

@Entity
@Table(name = "rally_read_grants", uniqueConstraints = @UniqueConstraint(columnNames = {"account_id", "rally_id"}))
public class RallyReadGrantEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private AuthUserEntity recipient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rally_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private RallyEntity rally;

    @Column(nullable = false)
    private boolean active;

    protected RallyReadGrantEntity() {}

    public RallyReadGrantEntity(AuthUserEntity recipient, RallyEntity rally, boolean active) {
        this.recipient = recipient;
        this.rally = rally;
        this.active = active;
    }
}
