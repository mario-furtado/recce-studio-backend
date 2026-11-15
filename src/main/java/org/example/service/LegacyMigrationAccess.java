package org.example.service;

import org.example.entity.*;
import org.example.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import java.util.List;

/** Migration receipts remain authoritative even when new UI/crew flags are off. */
@Service
public class LegacyMigrationAccess {
    private final LegacyCrewMigrationRepository migrations;
    private final CrewRepository crews;
    private final TeamProfileRepository profiles;
    private final AuthUserRepository users;
    private final CrewTransferRepository transfers;
    public LegacyMigrationAccess(LegacyCrewMigrationRepository migrations,CrewRepository crews,TeamProfileRepository profiles,AuthUserRepository users,CrewTransferRepository transfers) {
        this.migrations=migrations; this.crews=crews; this.profiles=profiles; this.users=users;
        this.transfers=transfers;
    }
    public String resolve(AuthUserEntity user) {
        try { return resolveChecked(user); }
        catch (org.springframework.dao.DataAccessException ex) { throw inconsistent(); }
    }
    private String resolveChecked(AuthUserEntity user) {
        List<LegacyCrewMigrationEntity> owned=migrations.findAllByOwnerAccountId(user.getId());
        if (Boolean.TRUE.equals(user.getLegacyCrewMigrated())) {
            if (StringUtils.hasText(user.getTeamProfileId()) || owned.size()!=1) throw inconsistent();
            String id=owned.get(0).teamProfileId;
            CrewEntity crew=crews.findById(id).filter(c -> user.getId().equals(c.creatorId())).orElseThrow(this::inconsistent);
            if (!profiles.findById(crew.id).map(p -> Boolean.TRUE.equals(p.getManagedCrew())).orElse(false)) throw inconsistent();
            if (!user.getId().equals(crew.ownerAccountId)) {
                if (!transfers.existsByCrewIdAndRecipientIdAndAcceptedAtIsNotNull(id, crew.ownerAccountId)) throw inconsistent();
                return null;
            }
            return id;
        }
        if (!owned.isEmpty()) throw inconsistent();
        if (StringUtils.hasText(user.getTeamProfileId()) && migrations.existsById(user.getTeamProfileId()))
            throw new AccountFlowException(HttpStatus.FORBIDDEN,"Contexto convertido indisponível para esta conta.");
        return user.getTeamProfileId();
    }
    public boolean hasCutover() { return migrations.count()>0 || users.existsByLegacyCrewMigratedTrue(); }
    public void checkCrew(String accountId,String crewId) {
        LegacyCrewMigrationEntity receipt=migrations.findById(crewId).orElse(null);
        if (receipt == null) return;
        CrewEntity crew=crews.findByIdAndOwnerAccountId(crewId,accountId)
                .filter(c -> receipt.ownerAccountId.equals(c.creatorId())).orElseThrow(this::inconsistent);
        if (receipt.ownerAccountId.equals(accountId)) {
            AuthUserEntity user=users.findById(accountId).orElseThrow(this::inconsistent);
            if (!crewId.equals(resolve(user))) throw inconsistent();
        } else if (!transfers.existsByCrewIdAndRecipientIdAndAcceptedAtIsNotNull(crew.id, accountId)) {
            throw inconsistent();
        }
    }
    private AccountFlowException inconsistent() { return new AccountFlowException(HttpStatus.SERVICE_UNAVAILABLE,"A autorização deste contexto requer reconciliação. Contacta o responsável."); }
}
