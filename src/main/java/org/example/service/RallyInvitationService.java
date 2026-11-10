package org.example.service;

import org.example.entity.*;
import org.example.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class RallyInvitationService {
    public enum Action { READ, ACCEPT, DECLINE }
    private static final long VALIDITY = Duration.ofDays(7).toMillis();
    private static final long QUOTA_WINDOW = Duration.ofDays(1).toMillis();
    private static final int QUOTA = 10;
    private static final int PAGE_SIZE = 20;

    private final RallyInvitationRepository invitations;
    private final RallyRepository rallies;
    private final AuthUserRepository users;
    private final RallyReadGrantRepository grants;
    private final InvitationQuotaRepository quotas;
    private final RallyAccessEventRepository events;
    private final TeamProfileRepository profiles;
    private final CrewService crews;
    private final PersonalAccountService accounts;
    private final Clock clock;
    private final boolean enabled;

    public RallyInvitationService(RallyInvitationRepository invitations, RallyRepository rallies,
                                  AuthUserRepository users, RallyReadGrantRepository grants, InvitationQuotaRepository quotas,
                                  RallyAccessEventRepository events, TeamProfileRepository profiles, CrewService crews,
                                  PersonalAccountService accounts, Clock clock,
                                  @Value("${recce.invitations.enabled:false}") boolean enabled) {
        this.invitations = invitations;
        this.rallies = rallies;
        this.users = users;
        this.grants = grants;
        this.quotas = quotas;
        this.events = events;
        this.profiles = profiles;
        this.crews = crews;
        this.accounts = accounts;
        this.clock = clock;
        this.enabled = enabled;
    }

    public boolean enabled() { return enabled && crews.enabled(); }

    @Transactional
    public void send(String actor, String rallyId, String address) {
        requireEnabled();
        String email = accounts.normalizeEmail(address);
        // The owner's row serializes their quota across rallies. All transitions then lock the rally.
        AuthUserEntity owner = users.lockById(actor).filter(AuthUserEntity::isActive).orElseThrow(RallyInvitationService::missing);
        RallyEntity rally = ownedRally(actor, rallyId, true);
        if (owner.getEmail().equalsIgnoreCase(email)) throw new IllegalArgumentException("Indica um endereço diferente do teu.");
        long now = clock.millis();
        if (invitations.existsByRallyIdAndRecipientEmailAndStateAndExpiresAtGreaterThan(rallyId, email, "PENDING", now)
                || invitations.existsByRallyIdAndInviterIdAndRecipientEmailAndState(rallyId, actor, email, "ACCEPTED")) return;

        InvitationQuotaEntity quota = quotas.findById(actor).orElseGet(() -> new InvitationQuotaEntity(actor));
        long retryAfter = quota.record(now, QUOTA_WINDOW, QUOTA);
        if (retryAfter > 0) throw new AccountFlowException(HttpStatus.TOO_MANY_REQUESTS,
                "Atingiste o limite de novos convites. Tenta mais tarde.", retryAfter);
        String recipient = users.findByEmailIgnoreCase(email).filter(user -> Boolean.TRUE.equals(user.getEmailVerified()))
                .map(AuthUserEntity::getId).orElse(null);
        String origin = profiles.findById(rally.getTeamProfileId()).map(TeamProfileEntity::getName)
                .filter(name -> !name.trim().isEmpty()).orElse("Tripulação do rali");
        quotas.save(quota);
        RallyInvitationEntity invitation = invitations.save(new RallyInvitationEntity(rally, actor, origin, email, recipient, now, now + VALIDITY));
        events.save(RallyAccessEventEntity.invitation(invitation, actor, RallyAccessEventEntity.Action.INVITED, now));
    }

    @Transactional(readOnly = true)
    public Inbox sent(String actor, String rallyId, int page) {
        requireEnabled();
        ownedRally(actor, rallyId, false);
        return inbox(invitations.findByRallyIdAndInviterIdOrderByCreatedAtDescIdDesc(rallyId, actor, page(page)),
                clock.millis(), true, 0);
    }

    @Transactional(readOnly = true)
    public Inbox received(String actor, int page) {
        requireEnabled();
        Optional<AuthUserEntity> account = users.findById(actor).filter(RallyInvitationService::isVerified);
        if (!account.isPresent()) return new Inbox(java.util.Collections.emptyList(), false, 0);
        long now = clock.millis();
        String email = accounts.normalizeEmail(account.get().getEmail());
        return inbox(invitations.received(actor, email, now, page(page)), now, false, invitations.unread(actor, email, now));
    }

    @Transactional(readOnly = true)
    public long unread(String actor) {
        requireEnabled();
        long now = clock.millis();
        return users.findById(actor).filter(RallyInvitationService::isVerified)
                .map(account -> invitations.unread(actor, accounts.normalizeEmail(account.getEmail()), now)).orElse(0L);
    }

    @Transactional(readOnly = true)
    public InvitationView detail(String actor, String id) {
        requireEnabled();
        AuthUserEntity recipient = users.findById(actor).filter(RallyInvitationService::isVerified).orElseThrow(RallyInvitationService::missing);
        long now = clock.millis();
        return view(receivedOne(id, recipient, now), now, false);
    }

    @Transactional
    public InvitationView respond(String actor, String id, Action action) {
        requireEnabled();
        AuthUserEntity recipient = users.lockById(actor).filter(RallyInvitationService::isVerified).orElseThrow(RallyInvitationService::missing);
        String email = accounts.normalizeEmail(recipient.getEmail());
        String rallyId = invitations.receivedRally(id, actor, email, clock.millis()).orElseThrow(RallyInvitationService::missing);
        RallyEntity rally = rallies.lockById(rallyId).orElseThrow(RallyInvitationService::missing);
        long now = clock.millis();
        RallyInvitationEntity invitation = receivedOne(id, recipient, now);
        if (action == Action.READ) {
            invitation.markRead(actor, now);
        } else {
            String target = action == Action.ACCEPT ? "ACCEPTED" : "DECLINED";
            String state = invitation.stateAt(now);
            if (target.equals(state)) return view(invitation, now, false);
            if (!"PENDING".equals(state)) throw closed();
            if ("ACCEPTED".equals(target)) {
                users.findById(invitation.getInviterId()).filter(AuthUserEntity::isActive).orElseThrow(RallyInvitationService::missing);
                crews.requireOwned(invitation.getInviterId(), rally.getTeamProfileId());
                Optional<RallyReadGrantEntity> existing = grants.findByRecipientIdAndRallyId(actor, rallyId);
                if (existing.isPresent() && !existing.get().isActive()) throw closed();
                if (!existing.isPresent() && !actor.equals(invitation.getInviterId())) {
                    grants.save(RallyReadGrantEntity.fromInvitation(recipient, rally, invitation.getId(), now));
                }
            }
            invitation.markRead(actor, now);
            invitation.decide(target, now);
            events.save(RallyAccessEventEntity.invitation(invitation, actor, RallyAccessEventEntity.Action.valueOf(target), now));
        }
        return view(invitation, now, false);
    }

    @Transactional
    public void cancel(String actor, String rallyId, String id) {
        requireEnabled();
        ownedRally(actor, rallyId, true);
        RallyInvitationEntity invitation = invitations.findById(id)
                .filter(value -> rallyId.equals(value.getRally().getId()) && actor.equals(value.getInviterId()))
                .orElseThrow(RallyInvitationService::missing);
        long now = clock.millis();
        String state = invitation.stateAt(now);
        if ("CANCELLED".equals(state)) return;
        if (!"PENDING".equals(state)) throw closed();
        invitation.decide("CANCELLED", now);
        events.save(RallyAccessEventEntity.invitation(invitation, actor, RallyAccessEventEntity.Action.CANCELLED, now));
    }

    private RallyEntity ownedRally(String actor, String id, boolean lock) {
        RallyEntity rally = rallies.findById(id).orElseThrow(RallyInvitationService::missing);
        crews.requireOwned(actor, rally.getTeamProfileId());
        return lock ? rallies.lockById(id).orElseThrow(RallyInvitationService::missing) : rally;
    }

    private RallyInvitationEntity receivedOne(String id, AuthUserEntity recipient, long now) {
        return invitations.receivedOne(id, recipient.getId(), accounts.normalizeEmail(recipient.getEmail()), now)
                .orElseThrow(RallyInvitationService::missing);
    }

    private void requireEnabled() {
        if (!enabled()) throw new AccountFlowException(HttpStatus.FORBIDDEN, "Os convites estão indisponíveis.");
    }

    private static boolean isVerified(AuthUserEntity user) {
        return user.isActive() && Boolean.TRUE.equals(user.getEmailVerified());
    }

    private static ResourceNotFoundException missing() { return new ResourceNotFoundException("Convite ou rali indisponível."); }
    private static AccountFlowException closed() { return new AccountFlowException(HttpStatus.CONFLICT, "O convite já não permite esta ação."); }

    private static PageRequest page(int page) {
        if (page < 0 || page > 1000) throw new IllegalArgumentException("Página inválida.");
        return PageRequest.of(page, PAGE_SIZE);
    }

    private Inbox inbox(List<RallyInvitationEntity> items, long now, boolean sender, long unread) {
        return new Inbox(items.stream().map(item -> view(item, now, sender)).collect(Collectors.toList()),
                items.size() == PAGE_SIZE, unread);
    }

    private InvitationView view(RallyInvitationEntity invitation, long now, boolean sender) {
        String accessStatus = null;
        if ("ACCEPTED".equals(invitation.getState())) {
            accessStatus = grants.findByRecipientIdAndRallyId(invitation.getRecipientId(), invitation.getRally().getId())
                    .map(grant -> grant.isActive() ? "ACTIVE" : "REVOKED").orElse("UNAVAILABLE");
        }
        return new InvitationView(invitation, now, sender, accessStatus);
    }

    @lombok.Getter
    @lombok.AllArgsConstructor
    public static class Inbox {
        private final List<InvitationView> items;
        private final boolean hasMore;
        private final long unread;
    }

    @lombok.Getter
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public static class InvitationView {
        private final String id;
        private final String rallyId;
        private final String rallyName;
        private final String crewName;
        private final String state;
        private final String recipientEmail;
        private final String accessStatus;
        private final long createdAt;
        private final long expiresAt;
        private final boolean read;

        InvitationView(RallyInvitationEntity invitation, long now, boolean sender, String accessStatus) {
            id = invitation.getId();
            rallyId = invitation.getRally().getId();
            rallyName = invitation.getRally().getName();
            crewName = invitation.getCrewName();
            state = invitation.stateAt(now);
            recipientEmail = sender ? invitation.getRecipientEmail() : null;
            this.accessStatus = accessStatus;
            createdAt = invitation.getCreatedAt();
            expiresAt = invitation.getExpiresAt();
            read = !sender && invitation.getReadAt() != null;
        }
    }
}
