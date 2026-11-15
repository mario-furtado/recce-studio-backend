package org.example.repository;

import org.example.entity.OfflineRecceSyncEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OfflineRecceSyncRepository extends JpaRepository<OfflineRecceSyncEntity, String> {
    Optional<OfflineRecceSyncEntity> findByOfflineSessionId(String offlineSessionId);
    Optional<OfflineRecceSyncEntity> findByOfflineSessionIdAndTeamProfileId(String offlineSessionId, String teamProfileId);
    @Query("select count(s) from OfflineRecceSyncEntity s where s.offlineSessionId = :sessionId "
            + "and (s.ownerAccountId = :account or (s.ownerAccountId is null and lower(s.userEmail) = lower(:email))) "
            + "and (s.teamProfileId is null or s.teamProfileId <> :team)")
    long countOtherContexts(@Param("sessionId") String sessionId, @Param("account") String account,
                            @Param("email") String email, @Param("team") String team);
    Optional<OfflineRecceSyncEntity> findTopByPecIdOrderBySyncedAtDesc(String pecId);
    Optional<OfflineRecceSyncEntity> findTopByPecIdAndTeamProfileIdOrderBySyncedAtDescIdDesc(String pecId, String teamProfileId);
    List<OfflineRecceSyncEntity> findByPecIdOrderBySyncedAtDesc(String pecId);
    List<OfflineRecceSyncEntity> findByPecIdAndTeamProfileIdOrderBySyncedAtDesc(String pecId, String teamProfileId);
    List<OfflineRecceSyncEntity> findByTeamProfileIdIsNull();
}
