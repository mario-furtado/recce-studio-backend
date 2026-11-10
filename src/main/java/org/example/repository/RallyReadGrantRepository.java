package org.example.repository;

import org.example.entity.RallyEntity;
import org.example.entity.RallyReadGrantEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RallyReadGrantRepository extends JpaRepository<RallyReadGrantEntity, Long> {
    String VISIBLE = "select g.rally from RallyReadGrantEntity g where g.recipient.id = :account and g.active = true "
            + "and exists (select c.id from CrewEntity c, TeamProfileEntity p "
            + "where c.id = g.rally.teamProfileId and p.id = c.id and p.managedCrew = true)";

    @Query(VISIBLE + " order by g.rally.name, g.rally.id")
    List<RallyEntity> listVisible(@Param("account") String account);

    @Query(VISIBLE + " and g.rally.id = :rally")
    Optional<RallyEntity> findVisible(@Param("account") String account, @Param("rally") String rally);
}
