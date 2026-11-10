package org.example.repository;

import org.example.entity.LegacyCrewMigrationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LegacyCrewMigrationRepository extends JpaRepository<LegacyCrewMigrationEntity,String> {
    List<LegacyCrewMigrationEntity> findAllByOwnerAccountId(String ownerAccountId);
}
