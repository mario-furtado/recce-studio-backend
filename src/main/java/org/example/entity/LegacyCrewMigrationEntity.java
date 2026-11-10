package org.example.entity;

import javax.persistence.*;

@Entity
@Table(name="legacy_crew_migrations",uniqueConstraints=@UniqueConstraint(name="uq_legacy_crew_owner",columnNames="owner_account_id"))
public class LegacyCrewMigrationEntity {
    @Id @Column(name="team_profile_id") public String teamProfileId;
    @Column(name="owner_account_id",nullable=false,updatable=false) public String ownerAccountId;
    @Column(nullable=false,updatable=false) public String manifestDigest;
    @Column(nullable=false,updatable=false) public String sourceDigest;
    @Column(nullable=false,updatable=false) public String backupDigest;
    @Column(nullable=false,updatable=false) public String approvedBy;
    @Column(nullable=false,updatable=false) public String approvalReference;
    public long convertedAt;
}
