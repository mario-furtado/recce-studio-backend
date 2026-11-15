package org.example.repository;

import org.example.entity.CrewTransferEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CrewTransferRepository extends JpaRepository<CrewTransferEntity, String> {
    interface Sender { String getSenderId(); }
    Optional<Sender> findByIdAndRecipientId(String id, String recipientId);
    List<CrewTransferEntity> findByRecipientIdAndAcceptedAtIsNullAndCancelledAtIsNullAndExpiresAtGreaterThanOrderByCreatedAtDesc(
            String recipientId, long now, Pageable page);
    List<CrewTransferEntity> findByCrewIdAndAcceptedAtIsNullAndCancelledAtIsNullAndExpiresAtGreaterThan(String crewId, long now);
    boolean existsByCrewIdAndRecipientIdAndAcceptedAtIsNotNull(String crewId, String recipientId);
}
