package org.example.repository;

import org.example.entity.RallyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RallyRepository extends JpaRepository<RallyEntity, String> {
    interface SharingSummary {
        String getId();
        String getName();
        @com.fasterxml.jackson.annotation.JsonIgnore
        String getCrewId();
        String getCrewName();
        String getStatus();
        Long getArchivedAt();
        long getActiveReaders();
        long getPendingInvitations();
    }

    @org.springframework.data.jpa.repository.Query("select r.id as id, r.name as name, c.id as crewId, p.name as crewName, "
            + "r.status as status, r.archivedAt as archivedAt, "
            + "(select count(g) from RallyReadGrantEntity g where g.rally.id = r.id and g.active = true) as activeReaders, "
            + "(select count(i) from RallyInvitationEntity i where i.rally.id = r.id and i.inviterId = :actor "
            + "and i.state = 'PENDING' and i.expiresAt > :now) as pendingInvitations "
            + "from RallyEntity r, CrewEntity c, TeamProfileEntity p "
            + "where r.teamProfileId = c.id and p.id = c.id and p.managedCrew = true and c.ownerAccountId = :actor "
            + "and (:sharedOnly = false "
            + "or exists (select g.id from RallyReadGrantEntity g where g.rally.id = r.id and g.active = true) "
            + "or exists (select i.id from RallyInvitationEntity i where i.rally.id = r.id and i.inviterId = :actor "
            + "and i.state = 'PENDING' and i.expiresAt > :now)) "
            + "order by r.year desc, r.name, r.id")
    org.springframework.data.domain.Slice<SharingSummary> findSharingSummary(
            @org.springframework.data.repository.query.Param("actor") String actor,
            @org.springframework.data.repository.query.Param("now") long now,
            @org.springframework.data.repository.query.Param("sharedOnly") boolean sharedOnly,
            org.springframework.data.domain.Pageable page);

    List<RallyEntity> findAllByOrderByYearDescNameAsc();
    List<RallyEntity> findAllByTeamProfileIdOrderByYearDescNameAsc(String teamProfileId);
    java.util.Optional<RallyEntity> findByIdAndTeamProfileId(String id, String teamProfileId);
    List<RallyEntity> findByTeamProfileId(String teamProfileId);
    List<RallyEntity> findByTeamProfileIdIsNull();

    @org.springframework.data.jpa.repository.Lock(javax.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select r from RallyEntity r where r.id = :id")
    java.util.Optional<RallyEntity> lockById(@org.springframework.data.repository.query.Param("id") String id);
}
