package org.example.service;

import org.example.dto.NoteDictionaryRuleDTO;
import org.example.entity.NoteDictionaryRuleEntity;
import org.example.repository.NoteDictionaryRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class NoteDictionaryRuleService {
    private final NoteDictionaryRuleRepository noteDictionaryRuleRepository;

    public NoteDictionaryRuleService(NoteDictionaryRuleRepository noteDictionaryRuleRepository) {
        this.noteDictionaryRuleRepository = noteDictionaryRuleRepository;
    }

    public List<NoteDictionaryRuleDTO> list(String userEmail) {
        return noteDictionaryRuleRepository.findByUserEmailIgnoreCaseOrderByPhraseAsc(userEmail)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public NoteDictionaryRuleDTO create(String userEmail, NoteDictionaryRuleDTO dto) {
        validate(dto);
        String phraseKey = normalizePhrase(dto.getPhrase());
        NoteDictionaryRuleEntity entity = noteDictionaryRuleRepository
                .findByUserEmailIgnoreCaseAndPhraseKey(userEmail, phraseKey)
                .orElseGet(() -> {
                    NoteDictionaryRuleEntity created = new NoteDictionaryRuleEntity();
                    created.setId(UUID.randomUUID().toString());
                    created.setUserEmail(userEmail);
                    created.setCreatedAt(LocalDateTime.now());
                    return created;
                });

        apply(dto, entity, phraseKey);
        return toDTO(noteDictionaryRuleRepository.save(entity));
    }

    @Transactional
    public NoteDictionaryRuleDTO update(String userEmail, String ruleId, NoteDictionaryRuleDTO dto) {
        validate(dto);
        NoteDictionaryRuleEntity entity = noteDictionaryRuleRepository.findByIdAndUserEmailIgnoreCase(ruleId, userEmail)
                .orElseThrow(() -> new RuntimeException("Regra nao encontrada."));

        apply(dto, entity, normalizePhrase(dto.getPhrase()));
        return toDTO(noteDictionaryRuleRepository.save(entity));
    }

    @Transactional
    public void delete(String userEmail, String ruleId) {
        NoteDictionaryRuleEntity entity = noteDictionaryRuleRepository.findByIdAndUserEmailIgnoreCase(ruleId, userEmail)
                .orElseThrow(() -> new RuntimeException("Regra nao encontrada."));
        noteDictionaryRuleRepository.delete(entity);
    }

    private void validate(NoteDictionaryRuleDTO dto) {
        if (dto == null || !StringUtils.hasText(dto.getPhrase()) || !StringUtils.hasText(dto.getSymbol())) {
            throw new IllegalArgumentException("Frase e simbolo sao obrigatorios.");
        }
    }

    private void apply(NoteDictionaryRuleDTO dto, NoteDictionaryRuleEntity entity, String phraseKey) {
        entity.setPhrase(dto.getPhrase().trim());
        entity.setPhraseKey(phraseKey);
        entity.setSymbol(dto.getSymbol().trim());
        entity.setCategory(StringUtils.hasText(dto.getCategory()) ? dto.getCategory().trim() : "");
        entity.setEnabled(dto.isEnabled());
        entity.setUpdatedAt(LocalDateTime.now());
    }

    private String normalizePhrase(String phrase) {
        String text = phrase == null ? "" : phrase.trim().toLowerCase();
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "");
        return normalized.replaceAll("[^a-z0-9]+", " ").trim().replaceAll("\\s+", " ");
    }

    private NoteDictionaryRuleDTO toDTO(NoteDictionaryRuleEntity entity) {
        NoteDictionaryRuleDTO dto = new NoteDictionaryRuleDTO();
        dto.setId(entity.getId());
        dto.setPhrase(entity.getPhrase());
        dto.setSymbol(entity.getSymbol());
        dto.setCategory(entity.getCategory());
        dto.setEnabled(entity.isEnabled());
        return dto;
    }
}
