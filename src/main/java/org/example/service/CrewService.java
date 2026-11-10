package org.example.service;

import org.example.entity.*;
import org.example.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.*;

@Service
public class CrewService {
    private final CrewRepository crews;
    private final AuthUserRepository users;
    private final TeamProfileRepository profiles;
    private final boolean enabled;
    private final Clock clock;
    private final LegacyMigrationAccess migrationAccess;
    public CrewService(CrewRepository crews, AuthUserRepository users, TeamProfileRepository profiles, Clock clock,
                       @Value("${recce.crews.enabled:false}") boolean enabled, LegacyMigrationAccess migrationAccess) {
        this.crews=crews; this.users=users; this.profiles=profiles; this.clock=clock; this.enabled=enabled;
        this.migrationAccess=migrationAccess;
    }
    public boolean enabled() { return enabled; }
    private void requireEnabled() {
        if (!enabled) throw new AccountFlowException(HttpStatus.FORBIDDEN, "A criação de tripulações ainda não está disponível.");
    }
    public CrewEntity requireOwned(String accountId, String id) {
        requireEnabled();
        CrewEntity crew=crews.findByIdAndOwnerAccountId(id,accountId).orElseThrow(() -> new ResourceNotFoundException("Tripulação indisponível."));
        profiles.findById(crew.id).filter(p -> Boolean.TRUE.equals(p.getManagedCrew())).orElseThrow(() -> new ResourceNotFoundException("Tripulação indisponível."));
        migrationAccess.checkCrew(accountId,crew.id);
        return crew;
    }
    public List<Map<String,Object>> list(String accountId) {
        requireEnabled(); List<Map<String,Object>> result=new ArrayList<>();
        crews.findAllByOwnerAccountIdOrderByCreatedAtAscIdAsc(accountId).forEach(c -> result.add(view(c))); return result;
    }
    @Transactional
    public Map<String,Object> create(String accountId, String name, String key) {
        requireEnabled();
        String normalized=name==null ? "" : name.trim();
        if (normalized.isEmpty() || normalized.length()>100 || normalized.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("Indica um nome de tripulação entre 1 e 100 caracteres.");
        if (key==null || !key.matches("[a-zA-Z0-9_-]{16,64}")) throw new IllegalArgumentException("Pedido de criação inválido. Tenta novamente.");
        AuthUserEntity user=users.lockById(accountId).orElseThrow(() -> new AccountFlowException(HttpStatus.UNAUTHORIZED,"Sessão inválida."));
        if (!user.isActive()) throw new AccountFlowException(HttpStatus.UNAUTHORIZED,"Sessão inválida.");
        CrewEntity previous=crews.findByOwnerAccountIdAndCreationKey(accountId,key).orElse(null);
        if (previous!=null) {
            if (!previous.name.equals(normalized)) throw new AccountFlowException(HttpStatus.CONFLICT,"O pedido já foi usado para outra tripulação. Atualiza a página.");
            return view(previous);
        }
        CrewEntity crew=new CrewEntity(); crew.id=UUID.randomUUID().toString(); crew.ownerAccountId=accountId; crew.creationKey=key; crew.name=normalized; crew.createdAt=clock.millis();
        TeamProfileEntity profile=new TeamProfileEntity(); profile.setId(crew.id); profile.setName(normalized); profile.setManagedCrew(true);
        profile.setNoteSystem("1-6 (1 Lento, 6 Rapido)"); profile.setDistanceUnit("Quilometros (km)");
        profiles.save(profile); crews.save(crew); return view(crew);
    }
    private Map<String,Object> view(CrewEntity crew) {
        Map<String,Object> result=new LinkedHashMap<>(); result.put("id",crew.id);
        // Profile name is the existing single source edited on the team screen.
        result.put("name",profiles.findById(crew.id).map(TeamProfileEntity::getName).orElse(crew.name));
        result.put("role","OWNER"); return result;
    }
}
