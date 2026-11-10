package org.example.repository;

import org.example.entity.AccountRateLimitEntity;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import javax.persistence.LockModeType;
import java.util.Optional;

public interface AccountRateLimitRepository extends JpaRepository<AccountRateLimitEntity, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from AccountRateLimitEntity r where r.id = :id")
    Optional<AccountRateLimitEntity> lock(@Param("id") String id);
    @Modifying
    @Query("delete from AccountRateLimitEntity r where r.id <> '!guard' and r.lastAttemptAt <= :cutoff")
    int deleteExpired(@Param("cutoff") long cutoff);
    @org.springframework.transaction.annotation.Transactional
    void deleteByIdNot(String id);
}
