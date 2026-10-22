package org.example.config;

import org.example.entity.OfflineRecceSyncEntity;
import org.example.entity.PecEntity;
import org.example.entity.RallyEntity;
import org.example.entity.TeamCarEntity;
import org.example.repository.AuthUserRepository;
import org.example.repository.OfflineRecceSyncRepository;
import org.example.repository.PecRepository;
import org.example.repository.RallyRepository;
import org.example.repository.TeamCarRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Set;
import java.util.stream.Collectors;

@Component
@Order(100)
public class OwnershipMigration implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(OwnershipMigration.class);

    private final AuthUserRepository authUserRepository;
    private final RallyRepository rallyRepository;
    private final TeamCarRepository teamCarRepository;
    private final PecRepository pecRepository;
    private final OfflineRecceSyncRepository syncRepository;

    public OwnershipMigration(
            AuthUserRepository authUserRepository,
            RallyRepository rallyRepository,
            TeamCarRepository teamCarRepository,
            PecRepository pecRepository,
            OfflineRecceSyncRepository syncRepository) {
        this.authUserRepository = authUserRepository;
        this.rallyRepository = rallyRepository;
        this.teamCarRepository = teamCarRepository;
        this.pecRepository = pecRepository;
        this.syncRepository = syncRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        Set<String> teamProfileIds = authUserRepository.findAll().stream()
                .map(user -> user.getTeamProfileId())
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());

        if (teamProfileIds.size() != 1) {
            if (!rallyRepository.findByTeamProfileIdIsNull().isEmpty()
                    || !teamCarRepository.findByTeamProfileIdIsNull().isEmpty()) {
                log.warn("Legacy records without ownership were left inaccessible because {} teams exist.",
                        teamProfileIds.size());
            }
            migrateSyncOwnership();
            return;
        }

        String soleTeamProfileId = teamProfileIds.iterator().next();
        for (RallyEntity rally : rallyRepository.findByTeamProfileIdIsNull()) {
            rally.setTeamProfileId(soleTeamProfileId);
            rallyRepository.save(rally);
        }
        for (TeamCarEntity car : teamCarRepository.findByTeamProfileIdIsNull()) {
            car.setTeamProfileId(soleTeamProfileId);
            teamCarRepository.save(car);
        }
        migrateSyncOwnership();
    }

    private void migrateSyncOwnership() {
        for (OfflineRecceSyncEntity sync : syncRepository.findByTeamProfileIdIsNull()) {
            PecEntity pec = pecRepository.findById(sync.getPecId()).orElse(null);
            if (pec == null || pec.getRally() == null
                    || !StringUtils.hasText(pec.getRally().getTeamProfileId())) {
                continue;
            }
            sync.setTeamProfileId(pec.getRally().getTeamProfileId());
            syncRepository.save(sync);
        }
    }
}
