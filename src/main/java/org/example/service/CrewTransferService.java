package org.example.service;

import org.example.entity.AuthUserEntity;
import org.example.entity.CrewEntity;
import org.example.entity.CrewTransferEntity;
import org.example.entity.RallyAccessEventEntity;
import org.example.entity.RallyEntity;
import org.example.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.persistence.EntityManager;

@Service
public class CrewTransferService {
    private final CrewService ownership;
    private final CrewRepository crews;
    private final AuthUserRepository users;
    private final CrewTransferRepository transfers;
    private final RallyRepository rallies;
    private final RallyInvitationRepository invitations;
    private final RallyAccessEventRepository events;
    private final Clock clock;
    private final EntityManager entities;
    private final boolean enabled;

    public CrewTransferService(CrewService ownership, CrewRepository crews, AuthUserRepository users,
                               CrewTransferRepository transfers, RallyRepository rallies,
                               RallyInvitationRepository invitations, RallyAccessEventRepository events, Clock clock,
                               EntityManager entities, @Value("${recce.crews.transfer.enabled:false}") boolean enabled) {
        this.ownership = ownership;
        this.crews = crews;
        this.users = users;
        this.transfers = transfers;
        this.rallies = rallies;
        this.invitations = invitations;
        this.events = events;
        this.clock = clock;
        this.entities = entities;
        this.enabled = enabled;
    }

    public boolean enabled() { return enabled && ownership.enabled(); }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> incoming(String actor, int page) {
        requireEnabled();
        if (page < 0 || page > 1000) throw new IllegalArgumentException("Página inválida.");
        return transfers.findByRecipientIdAndAcceptedAtIsNullAndCancelledAtIsNullAndExpiresAtGreaterThanOrderByCreatedAtDesc(
                        actor, clock.millis(), PageRequest.of(page, 20)).stream()
                .map(transfer -> view(transfer, crews.findById(transfer.crewId).orElse(null)))
                .collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> request(String actor, String token, String crewId, String email, String password) {
        requireEnabled();
        AuthUserEntity sender = lockAccount(actor);
        authenticate(sender, token, password);
        CrewEntity crew = lockOwned(actor, crewId);
        AuthUserEntity recipient = users.findByEmailIgnoreCase(email)
                .filter(CrewTransferService::eligibleRecipient).orElseThrow(CrewTransferService::unavailable);
        if (actor.equals(recipient.getId())) throw unavailable();
        long now = clock.millis();
        List<CrewTransferEntity> pending = pending(crewId, now);
        if (pending.size() == 1 && recipient.getId().equals(pending.get(0).recipientId)
                && Objects.equals(sender.getCredentialVersion(), pending.get(0).senderCredentialVersion)) {
            return view(pending.get(0), crew);
        }
        pending.forEach(value -> value.cancelledAt = now);
        CrewTransferEntity transfer = new CrewTransferEntity();
        transfer.id = UUID.randomUUID().toString();
        transfer.crewId = crewId;
        transfer.senderId = actor;
        transfer.recipientId = recipient.getId();
        transfer.senderCredentialVersion = sender.getCredentialVersion();
        transfer.createdAt = now;
        transfer.expiresAt = now + Duration.ofDays(7).toMillis();
        return view(transfers.save(transfer), crew);
    }

    @Transactional
    public void cancel(String actor, String token, String crewId, String password) {
        requireEnabled();
        authenticate(lockAccount(actor), token, password);
        lockOwned(actor, crewId);
        long now = clock.millis();
        pending(crewId, now).forEach(value -> value.cancelledAt = now);
    }

    @Transactional
    public void accept(String actor, String token, String transferId, String password) {
        requireEnabled();
        String senderId = transfers.findByIdAndRecipientId(transferId, actor)
                .map(CrewTransferRepository.Sender::getSenderId).orElseThrow(CrewTransferService::unavailable);
        // A stable account lock order also serializes transfers with self-deactivation.
        String firstId = actor.compareTo(senderId) < 0 ? actor : senderId;
        AuthUserEntity first = lockAccount(firstId);
        AuthUserEntity second = lockAccount(firstId.equals(actor) ? senderId : actor);
        AuthUserEntity recipient = firstId.equals(actor) ? first : second;
        AuthUserEntity sender = firstId.equals(actor) ? second : first;
        authenticate(recipient, token, password);
        if (!eligibleRecipient(recipient)) throw unavailable();
        CrewTransferEntity transfer = transfers.findById(transferId).orElseThrow(CrewTransferService::unavailable);
        CrewEntity crew = crews.lockById(transfer.crewId).orElseThrow(CrewTransferService::unavailable);
        if (transfer.acceptedAt != null && actor.equals(crew.ownerAccountId)) return;
        long now = clock.millis();
        if (transfer.cancelledAt != null || transfer.acceptedAt != null || transfer.expiresAt <= now
                || !sender.isActive() || !senderId.equals(crew.ownerAccountId)
                || !Objects.equals(sender.getCredentialVersion(), transfer.senderCredentialVersion)) throw unavailable();
        ownership.requireOwned(senderId, crew.id);
        if (crews.existsByOwnerAccountIdAndCreationKey(actor, crew.creationKey)) {
            throw new AccountFlowException(HttpStatus.CONFLICT, "Existe um conflito de identificação. Contacta o suporte.");
        }
        cancelPreviousInvitations(crew.id, actor, now);
        crew.originalOwnerAccountId = crew.creatorId();
        crew.ownerAccountId = actor;
        transfer.acceptedAt = now;
    }

    private void cancelPreviousInvitations(String crewId, String actor, long now) {
        rallies.findByTeamProfileId(crewId).stream().map(RallyEntity::getId).sorted(Comparator.naturalOrder())
                .forEach(id -> rallies.lockById(id).ifPresent(rally ->
                        invitations.findByRallyIdAndStateAndExpiresAtGreaterThan(id, "PENDING", now).forEach(invitation -> {
                            invitation.decide("CANCELLED", now);
                            events.save(RallyAccessEventEntity.invitation(invitation, actor, RallyAccessEventEntity.Action.CANCELLED, now));
                        })));
    }

    private CrewEntity lockOwned(String actor, String id) {
        crews.lockById(id).orElseThrow(CrewTransferService::unavailable);
        return ownership.requireOwned(actor, id);
    }

    private List<CrewTransferEntity> pending(String id, long now) {
        return transfers.findByCrewIdAndAcceptedAtIsNullAndCancelledAtIsNullAndExpiresAtGreaterThan(id, now);
    }

    private AuthUserEntity lockAccount(String id) {
        AuthUserEntity user = users.lockById(id).orElseThrow(CrewTransferService::unavailable);
        // The authentication interceptor may have loaded this row before the write lock.
        entities.refresh(user);
        return user;
    }

    private void authenticate(AuthUserEntity account, String token, String password) {
        Long expiry = account.getTokenExpiresAtEpochMillis();
        if (!account.isActive() || !token.equals(account.getToken()) || expiry == null || expiry <= clock.millis()) {
            throw new AccountFlowException(HttpStatus.UNAUTHORIZED, "Sessão inválida ou expirada.");
        }
        if (!AccountPasswords.matches(password, account.getPasswordHash())) {
            throw new AccountFlowException(HttpStatus.FORBIDDEN, "A password atual está incorreta.");
        }
    }

    private static boolean eligibleRecipient(AuthUserEntity user) {
        return user.isActive() && Boolean.TRUE.equals(user.getEmailVerified());
    }

    private void requireEnabled() {
        if (!enabled()) throw unavailable();
    }

    private static ResourceNotFoundException unavailable() {
        return new ResourceNotFoundException("Transferência indisponível. Confirma o pedido e a conta destinatária.");
    }

    private Map<String, Object> view(CrewTransferEntity transfer, CrewEntity crew) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", transfer.id);
        value.put("crewName", crew == null ? "Tripulação" : crew.name);
        value.put("expiresAt", transfer.expiresAt);
        return value;
    }
}
