package org.example.entity;

import javax.persistence.*;

@Entity
@Table(name = "crews", uniqueConstraints = @UniqueConstraint(name = "uq_crew_creation", columnNames = {"owner_account_id", "creation_key"}),
    indexes = @Index(name = "ix_crew_owner", columnList = "owner_account_id"))
public class CrewEntity {
    @Id public String id;
    @Column(name = "owner_account_id", nullable = false, updatable = false) public String ownerAccountId;
    @Column(name = "creation_key", nullable = false, updatable = false, length = 64) public String creationKey;
    @Column(nullable = false, length = 100) public String name;
    public long createdAt;
}
