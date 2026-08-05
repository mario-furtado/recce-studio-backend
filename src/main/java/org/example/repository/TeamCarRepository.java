package org.example.repository;

import org.example.entity.TeamCarEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamCarRepository extends JpaRepository<TeamCarEntity, String> {
    List<TeamCarEntity> findAllByOrderByNameAsc();
}
