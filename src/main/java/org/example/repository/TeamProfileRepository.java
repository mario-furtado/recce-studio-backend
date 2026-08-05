package org.example.repository;

import org.example.entity.TeamProfileEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TeamProfileRepository extends JpaRepository<TeamProfileEntity, String> {
}
