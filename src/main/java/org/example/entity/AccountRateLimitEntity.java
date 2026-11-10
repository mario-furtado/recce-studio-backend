package org.example.entity;

import javax.persistence.*;

@Entity
@Table(name = "account_rate_limits", indexes = @Index(name = "ix_account_limit_activity", columnList = "last_attempt_at"))
public class AccountRateLimitEntity {
    @Id public String id;
    @Column(nullable = false, length = 20000) public String attempts = "";
    @Column(name = "last_attempt_at") public long lastAttemptAt;
    public AccountRateLimitEntity() {}
    public AccountRateLimitEntity(String id) { this.id = id; }
}
