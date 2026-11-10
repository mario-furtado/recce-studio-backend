package org.example.repository;

import org.example.entity.RallyInvitationEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RallyInvitationRepository extends JpaRepository<RallyInvitationEntity, String> {
    String VISIBLE = "i.recipientEmail = :email and (i.recipientId = :account or "
            + "(i.recipientId is null and i.state = 'PENDING' and i.expiresAt > :now))";

    @Query("select i from RallyInvitationEntity i where " + VISIBLE + " order by i.createdAt desc, i.id desc")
    List<RallyInvitationEntity> received(@Param("account") String account, @Param("email") String email, @Param("now") long now, Pageable page);

    @Query("select count(i) from RallyInvitationEntity i where " + VISIBLE + " and i.readAt is null")
    long unread(@Param("account") String account, @Param("email") String email, @Param("now") long now);

    @Query("select i from RallyInvitationEntity i where i.id = :id and " + VISIBLE)
    Optional<RallyInvitationEntity> receivedOne(@Param("id") String id, @Param("account") String account, @Param("email") String email, @Param("now") long now);

    @Query("select i.rally.id from RallyInvitationEntity i where i.id = :id and " + VISIBLE)
    Optional<String> receivedRally(@Param("id") String id, @Param("account") String account, @Param("email") String email, @Param("now") long now);

    List<RallyInvitationEntity> findByRallyIdAndInviterIdOrderByCreatedAtDescIdDesc(String rally, String inviter, Pageable page);

    boolean existsByRallyIdAndRecipientEmailAndStateAndExpiresAtGreaterThan(String rally, String email, String state, long now);
    boolean existsByRallyIdAndInviterIdAndRecipientEmailAndState(String rally, String inviter, String email, String state);
}
