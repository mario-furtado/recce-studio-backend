package org.example.repository;

import org.example.entity.PecEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PecRepository extends JpaRepository<PecEntity, String> {
    List<PecEntity> findByRallyId(String rallyId);
    long countByRallyId(String rallyId);
}
