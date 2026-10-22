package org.example.repository;

import org.example.entity.PecEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PecRepository extends JpaRepository<PecEntity, String> {
    List<PecEntity> findByRallyId(String rallyId);
    List<PecEntity> findByRallyIdAndRallyTeamProfileId(String rallyId, String teamProfileId);
    java.util.Optional<PecEntity> findByIdAndRallyTeamProfileId(String id, String teamProfileId);
    List<PecEntity> findByRallyTeamProfileId(String teamProfileId);
    long countByRallyId(String rallyId);
}
