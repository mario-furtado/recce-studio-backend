package org.example.entity;

import javax.persistence.*;

@Entity
@Table(name = "account_challenges", indexes = @Index(name = "ix_account_challenge_expiry", columnList = "expires_at"))
public class AccountChallengeEntity {
    @Id public String tokenHash;
    @Column(nullable = false, length = 254) public String email;
    @Column(nullable = false) public String purpose;
    public String userId;
    public long credentialVersion;
    @Column(name = "expires_at") public long expiresAt;
    public boolean used;
}
