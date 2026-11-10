package org.example.repository;

import org.example.entity.CrewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface CrewRepository extends JpaRepository<CrewEntity, String> {
    Optional<CrewEntity> findByIdAndOwnerAccountId(String id, String ownerAccountId);
    Optional<CrewEntity> findByOwnerAccountIdAndCreationKey(String ownerAccountId, String creationKey);
    List<CrewEntity> findAllByOwnerAccountIdOrderByCreatedAtAscIdAsc(String ownerAccountId);
}
