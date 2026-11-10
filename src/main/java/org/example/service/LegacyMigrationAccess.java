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
    public LegacyMigrationAccess(LegacyCrewMigrationRepository migrations,CrewRepository crews,TeamProfileRepository profiles,AuthUserRepository users) {
        this.migrations=migrations; this.crews=crews; this.profiles=profiles; this.users=users;
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
            CrewEntity crew=crews.findByIdAndOwnerAccountId(id,user.getId()).orElseThrow(this::inconsistent);
            if (!profiles.findById(crew.id).map(p -> Boolean.TRUE.equals(p.getManagedCrew())).orElse(false)) throw inconsistent();
            return id;
        }
        if (!owned.isEmpty()) throw inconsistent();
        if (StringUtils.hasText(user.getTeamProfileId()) && migrations.existsById(user.getTeamProfileId()))
            throw new AccountFlowException(HttpStatus.FORBIDDEN,"Contexto convertido indisponível para esta conta.");
        return user.getTeamProfileId();
    }
    public boolean hasCutover() { return migrations.count()>0 || users.existsByLegacyCrewMigratedTrue(); }
    public void checkCrew(String accountId,String crewId) {
        if (!migrations.existsById(crewId)) return;
        AuthUserEntity user=users.findById(accountId).orElseThrow(this::inconsistent);
        if (!crewId.equals(resolve(user))) throw inconsistent();
    }
    private AccountFlowException inconsistent() { return new AccountFlowException(HttpStatus.SERVICE_UNAVAILABLE,"A autorização deste contexto requer reconciliação. Contacta o responsável."); }
}
