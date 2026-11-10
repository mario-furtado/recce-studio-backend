package org.example.service;

import lombok.Getter;
import org.example.entity.RallyAccessEventEntity;
import org.example.entity.RallyEntity;
import org.example.entity.RallyReadGrantEntity;
import org.example.repository.RallyAccessEventRepository;
import org.example.repository.RallyReadGrantRepository;
import org.example.repository.RallyRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

@Service
public class RallyAccessService {
    public enum Reason { COLLABORATION_ENDED, SHARING_ERROR, OTHER }

    private final RallyRepository rallies;
    private final RallyReadGrantRepository grants;
    private final RallyAccessEventRepository events;
    private final CrewService crews;
    private final Clock clock;

    public RallyAccessService(RallyRepository rallies, RallyReadGrantRepository grants, RallyAccessEventRepository events,
                              CrewService crews, Clock clock) {
        this.rallies = rallies;
        this.grants = grants;
        this.events = events;
        this.crews = crews;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AccessPage<GrantView> list(String actor, String rallyId, int page) {
        requireOwner(actor, rallyId);
        return new AccessPage<>(grants.findByRallyIdOrderByActiveDescIdDesc(rallyId, page(page)).map(GrantView::new));
    }

    @Transactional(readOnly = true)
    public AccessPage<RallyAccessEventEntity> history(String actor, String rallyId, int page) {
        requireOwner(actor, rallyId);
        return new AccessPage<>(events.findByRallyIdOrderByIdDesc(rallyId, page(page)));
    }

    @Transactional
    public void revoke(String actor, String rallyId, long grantId, Reason reason) {
        requireOwner(actor, rallyId);
        RallyEntity rally = rallies.lockById(rallyId).orElseThrow(RallyAccessService::missing);
        authorize(actor, rally);
        RallyReadGrantEntity grant = grants.findByIdAndRallyId(grantId, rallyId).orElseThrow(RallyAccessService::missing);
        if (!grant.isActive()) return;
        long now = clock.millis();
        grant.revoke(reason.name(), now);
        events.save(RallyAccessEventEntity.revocation(rallyId, grant, actor, reason.name(), now));
    }

    private void requireOwner(String actor, String rallyId) {
        if (!crews.enabled()) throw new AccountFlowException(HttpStatus.FORBIDDEN, "A gestão de acessos está indisponível.");
        authorize(actor, rallies.findById(rallyId).orElseThrow(RallyAccessService::missing));
    }

    private void authorize(String actor, RallyEntity rally) {
        try { crews.requireOwned(actor, rally.getTeamProfileId()); }
        catch (ResourceNotFoundException ex) { throw missing(); }
    }

    private static PageRequest page(int index) {
        if (index < 0 || index > 1000) throw new IllegalArgumentException("Página inválida.");
        return PageRequest.of(index, 20);
    }

    private static ResourceNotFoundException missing() {
        return new ResourceNotFoundException("Rali ou acesso indisponível.");
    }

    @Getter
    public static class AccessPage<T> {
        private final List<T> items;
        private final boolean hasMore;

        AccessPage(Slice<T> slice) {
            items = slice.getContent();
            hasMore = slice.hasNext();
        }
    }

    @Getter
    public static class GrantView {
        private final Long id;
        private final String recipientEmail;
        private final boolean active;
        private final Long revokedAt;
        private final String revocationReason;

        GrantView(RallyReadGrantEntity grant) {
            id = grant.getId();
            recipientEmail = grant.getRecipientEmail();
            active = grant.isActive();
            revokedAt = grant.getRevokedAt();
            revocationReason = grant.getRevocationReason();
        }
    }
}
