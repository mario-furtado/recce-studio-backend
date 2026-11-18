package org.example.repository;

import org.example.entity.AccountChallengeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface AccountChallengeRepository extends JpaRepository<AccountChallengeEntity, String> {
    @Modifying
    @Query("delete from AccountChallengeEntity c where c.expiresAt <= :now")
    int deleteExpired(@Param("now") long now);

    @Query("select c.email from AccountChallengeEntity c where c.tokenHash = :hash and c.purpose = :purpose and c.used = false and c.expiresAt > :now")
    Optional<String> pendingEmail(@Param("hash") String hash, @Param("purpose") String purpose, @Param("now") long now);

    @Modifying
    @Query("update AccountChallengeEntity c set c.registrationCodeExpiresAt = :now where c.tokenHash = :hash and c.registrationCodeHash = :codeHash")
    int expireRegistrationCode(@Param("hash") String hash, @Param("codeHash") String codeHash, @Param("now") long now);
}
