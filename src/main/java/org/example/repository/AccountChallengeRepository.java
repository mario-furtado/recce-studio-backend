package org.example.repository;

import org.example.entity.AccountChallengeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountChallengeRepository extends JpaRepository<AccountChallengeEntity, String> {
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("delete from AccountChallengeEntity c where c.expiresAt <= :now")
    int deleteExpired(@org.springframework.data.repository.query.Param("now") long now);
}
