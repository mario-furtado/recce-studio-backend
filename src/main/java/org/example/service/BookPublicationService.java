package org.example.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.example.controller.TenantContext;
import org.example.entity.BookPublicationEntity;
import org.example.entity.PecEntity;
import org.example.repository.BookPublicationRepository;
import org.example.repository.PecRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.Arrays;
import java.util.Optional;

@Service
public class BookPublicationService {
    private final BookPublicationRepository publications;
    private final PecRepository pecs;
    private final CrewService crews;
    private final TenantContext tenant;
    private final ObjectMapper json;

    public BookPublicationService(BookPublicationRepository publications, PecRepository pecs,
                                  CrewService crews, TenantContext tenant, ObjectMapper json) {
        this.publications = publications;
        this.pecs = pecs;
        this.crews = crews;
        this.tenant = tenant;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public Optional<Long> ownerRevision(PecEntity pec) {
        if (!crews.enabled()) return Optional.empty();
        if (!tenant.requireTeamProfileId().equals(pec.getRally().getTeamProfileId())) return Optional.empty();
        try {
            requireOwner();
        } catch (ResourceNotFoundException ex) {
            return Optional.empty();
        }
        return Optional.of(publications.findById(pec.getId()).map(BookPublicationEntity::getRevision).orElse(0L));
    }

    @Transactional
    public long publish(String pecId, JsonNode snapshot) {
        String team = requireOwner();
        PecEntity pec = pecs.lockOwnedPec(pecId, team).orElseThrow(BookPublicationService::missingPec);
        validate(snapshot);
        BookPublicationEntity publication = publications.findById(pecId).orElseGet(() -> new BookPublicationEntity(pec));
        publication.publish(snapshot.toString());
        return publications.save(publication).getRevision();
    }

    @Transactional(readOnly = true)
    public Optional<ObjectNode> read(String authorizedPecId) {
        return publications.findById(authorizedPecId).map(publication -> {
            try {
                ObjectNode result = json.createObjectNode();
                result.put("revision", publication.getRevision());
                result.set("snapshot", json.readTree(publication.getSnapshot()));
                return result;
            } catch (IOException ex) {
                throw new IllegalStateException("A publicação guardada não está disponível.", ex);
            }
        });
    }

    private String requireOwner() {
        String team = tenant.requireTeamProfileId();
        crews.requireOwned(tenant.requireAccountId(), team);
        return team;
    }

    private static ResourceNotFoundException missingPec() {
        return new ResourceNotFoundException("PEC não encontrada.");
    }

    private void validate(JsonNode snapshot) {
        fields(snapshot, "page", "cover", "notes");
        require(snapshot.toString().length() <= 1_000_000);
        ObjectNode settings = json.createObjectNode().put("version", 1);
        settings.set("page", snapshot.path("page"));
        settings.putArray("rules");
        NotebookPreferencesValidator.validate(settings);
        RecceBookCoverValidator.validate(snapshot.path("cover"));
        JsonNode notes = snapshot.path("notes");
        require(notes.isArray() && notes.size() <= 2_000);
        for (JsonNode note : notes) {
            require(note.isArray());
            for (JsonNode block : note) {
                fields(block, "breakBefore", "elements");
                JsonNode elements = block.path("elements");
                require(block.path("breakBefore").isBoolean() && elements.isArray() && !elements.isEmpty());
                for (JsonNode element : elements) validateElement(element);
            }
        }
    }

    private static void validateElement(JsonNode element) {
        fields(element, "display", "position", "size", "bold", "underline", "highlight");
        JsonNode display = element.path("display");
        require(display.isTextual() && !display.asText().trim().isEmpty()
                && display.asText().length() <= 2_000 && display.asText().chars().noneMatch(c -> c < 32));
        require(Arrays.asList("top-left", "top-center", "top-right", "middle-left", "center", "middle-right",
                "bottom-left", "bottom-center", "bottom-right").contains(element.path("position").asText()));
        JsonNode size = element.path("size");
        require(size.isIntegralNumber() && size.canConvertToInt() && size.intValue() >= 50 && size.intValue() <= 150);
        for (String flag : Arrays.asList("bold", "underline", "highlight")) require(element.path(flag).isBoolean());
    }

    private static void fields(JsonNode node, String... allowed) {
        require(node != null && node.isObject() && node.size() == allowed.length);
        node.fieldNames().forEachRemaining(field -> require(Arrays.asList(allowed).contains(field)));
    }

    private static void require(boolean valid) {
        if (!valid) throw new IllegalArgumentException("Caderno inválido ou acima dos limites de publicação.");
    }
}
