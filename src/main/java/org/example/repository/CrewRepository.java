package org.example.repository;

import org.example.entity.CrewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import javax.persistence.LockModeType;
import java.util.*;

public interface CrewRepository extends JpaRepository<CrewEntity, String> {
    Optional<CrewEntity> findByIdAndOwnerAccountId(String id, String ownerAccountId);
    @Query("select c from CrewEntity c where coalesce(c.originalOwnerAccountId, c.ownerAccountId) = :account and c.creationKey = :key")
    Optional<CrewEntity> findByCreatorAndCreationKey(@Param("account") String accountId, @Param("key") String creationKey);
    boolean existsByOwnerAccountIdAndCreationKey(String accountId, String creationKey);
    List<CrewEntity> findAllByOwnerAccountIdOrderByCreatedAtAscIdAsc(String ownerAccountId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CrewEntity c where c.id = :id")
    Optional<CrewEntity> lockById(@Param("id") String id);
}
