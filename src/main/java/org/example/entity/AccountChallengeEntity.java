package org.example.entity;

import javax.persistence.*;
import java.time.LocalDate;

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
    public String registrationCodeHash;
    public Long registrationCodeExpiresAt;
    public String pendingPasswordHash;
    @Column(length = 120)
    public String pendingDisplayName;
    public LocalDate pendingDateOfBirth;
}
