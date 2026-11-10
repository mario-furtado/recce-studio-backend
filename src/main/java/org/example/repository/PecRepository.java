package org.example.repository;

import org.example.entity.PecEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PecRepository extends JpaRepository<PecEntity, String> {
    List<PecEntity> findByRallyId(String rallyId);
    boolean existsByIdAndRallyId(String id, String rallyId);

    @org.springframework.data.jpa.repository.Lock(javax.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from PecEntity p where p.id = :id and p.rally.teamProfileId = :team")
    java.util.Optional<PecEntity> lockOwnedPec(@org.springframework.data.repository.query.Param("id") String id,
                                               @org.springframework.data.repository.query.Param("team") String team);
    List<PecEntity> findByRallyIdAndRallyTeamProfileId(String rallyId, String teamProfileId);
    java.util.Optional<PecEntity> findByIdAndRallyTeamProfileId(String id, String teamProfileId);
    List<PecEntity> findByRallyTeamProfileId(String teamProfileId);
    long countByRallyId(String rallyId);
}
