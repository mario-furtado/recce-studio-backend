package org.example.repository;

import org.example.entity.RallyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RallyRepository extends JpaRepository<RallyEntity, String> {
    List<RallyEntity> findAllByOrderByYearDescNameAsc();
    List<RallyEntity> findAllByTeamProfileIdOrderByYearDescNameAsc(String teamProfileId);
    java.util.Optional<RallyEntity> findByIdAndTeamProfileId(String id, String teamProfileId);
    List<RallyEntity> findByTeamProfileId(String teamProfileId);
    List<RallyEntity> findByTeamProfileIdIsNull();
}
