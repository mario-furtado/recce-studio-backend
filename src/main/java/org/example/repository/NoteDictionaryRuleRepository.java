package org.example.repository;

import org.example.entity.NoteDictionaryRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NoteDictionaryRuleRepository extends JpaRepository<NoteDictionaryRuleEntity, String> {
    List<NoteDictionaryRuleEntity> findByUserEmailIgnoreCaseOrderByPhraseAsc(String userEmail);
    Optional<NoteDictionaryRuleEntity> findByIdAndUserEmailIgnoreCase(String id, String userEmail);
    Optional<NoteDictionaryRuleEntity> findByUserEmailIgnoreCaseAndPhraseKey(String userEmail, String phraseKey);
}
