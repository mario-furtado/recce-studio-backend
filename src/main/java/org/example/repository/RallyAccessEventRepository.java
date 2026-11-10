package org.example.repository;

import org.example.entity.RallyAccessEventEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RallyAccessEventRepository extends JpaRepository<RallyAccessEventEntity, Long> {
    Slice<RallyAccessEventEntity> findByRallyIdOrderByIdDesc(String rallyId, Pageable page);
}
