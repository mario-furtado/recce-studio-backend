package org.example.repository;

import org.example.entity.OfflineRecceSyncEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OfflineRecceSyncRepository extends JpaRepository<OfflineRecceSyncEntity, String> {
    Optional<OfflineRecceSyncEntity> findByOfflineSessionId(String offlineSessionId);
    Optional<OfflineRecceSyncEntity> findTopByPecIdOrderBySyncedAtDesc(String pecId);
    List<OfflineRecceSyncEntity> findByPecIdOrderBySyncedAtDesc(String pecId);
}
