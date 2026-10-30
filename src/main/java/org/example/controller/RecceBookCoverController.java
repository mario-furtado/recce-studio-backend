package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.example.entity.PecEntity;
import org.example.entity.TeamProfileEntity;
import org.example.repository.PecRepository;
import org.example.repository.TeamCarRepository;
import org.example.repository.TeamProfileRepository;
import org.example.repository.AuthUserRepository;
import org.example.repository.RecceBookTemplateRepository;
import org.example.service.RecceBookCoverValidator;
import org.example.service.ResourceNotFoundException;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/pecs/{pecId}/reccebook-cover")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.PUT, RequestMethod.OPTIONS})
public class RecceBookCoverController {
    private final PecRepository pecs;
    private final TeamProfileRepository teams;
    private final TeamCarRepository cars;
    private final TenantContext tenant;
    private final ObjectMapper json;
    private final AuthUserRepository users;
    private final RecceBookTemplateRepository templates;
    public RecceBookCoverController(PecRepository pecs, TeamProfileRepository teams, TeamCarRepository cars, TenantContext tenant, ObjectMapper json, AuthUserRepository users, RecceBookTemplateRepository templates) {
        this.pecs = pecs; this.teams = teams; this.cars = cars; this.tenant = tenant; this.json = json;
        this.users = users; this.templates = templates;
    }
    private PecEntity require(String id) {
        return pecs.findByIdAndRallyTeamProfileId(id, tenant.requireTeamProfileId())
            .orElseThrow(() -> new ResourceNotFoundException("PEC não encontrada."));
    }
    private boolean editable(PecEntity pec) {
        return !"COMPLETED".equalsIgnoreCase(pec.getStatus()) && !"COMPLETED".equalsIgnoreCase(pec.getRally().getStatus());
    }
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<JsonNode> get(@PathVariable String pecId) throws Exception {
        PecEntity pec = require(pecId);
        ObjectNode response = json.createObjectNode();
        response.set("cover", pec.getRecceBookCover() == null ? initial(pec) : json.readTree(pec.getRecceBookCover()));
        response.put("editable", editable(pec));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(response);
    }
    @PutMapping
    @Transactional
    public ResponseEntity<JsonNode> save(@PathVariable String pecId, @RequestBody JsonNode value) {
        PecEntity pec = require(pecId);
        if (!editable(pec)) throw new IllegalStateException("PEC ou rali concluído. Volta a rascunho para editar a capa.");
        RecceBookCoverValidator.validate(value);
        pec.setRecceBookCover(value.toString()); pecs.save(pec);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);
    }
    private ObjectNode initial(PecEntity pec) throws Exception {
        ObjectNode root = json.createObjectNode(); root.put("version", 1);
        ObjectNode front = root.putObject("front"); front.put("background", "#ffffff"); ArrayNode elements = front.putArray("elements");
        TeamProfileEntity team = teams.findById(tenant.requireTeamProfileId()).orElse(null);
        String car = pec.getRally().getCarId() == null ? "—" : cars.findByIdAndTeamProfileId(pec.getRally().getCarId(), tenant.requireTeamProfileId()).map(c -> c.getName()).orElse("—");
        String userId = users.findByEmailIgnoreCase(tenant.requireUserEmail()).orElseThrow(() -> new IllegalStateException("Conta indisponível.")).getId();
        org.example.entity.RecceBookTemplateEntity template = templates.findById(userId).orElse(null);
        if (template != null) {
            ObjectNode cover = (ObjectNode) json.readTree(template.getCover());
            java.util.Map<String, String> fields = new java.util.HashMap<>();
            fields.put("rali", pec.getRally().getName()); fields.put("pec", "PEC " + pec.getNumber() + " — " + pec.getName());
            fields.put("equipa", team == null || team.getName().isEmpty() ? "—" : team.getName()); fields.put("carro", car); fields.put("data", LocalDate.now().toString());
            java.util.regex.Pattern tokens = java.util.regex.Pattern.compile("\\{\\{(rali|pec|equipa|carro|data)\\}\\}");
            for (String side : new String[]{"front", "back"}) for (JsonNode element : cover.path(side).path("elements")) {
                java.util.regex.Matcher match = tokens.matcher(element.path("text").asText());
                StringBuffer text = new StringBuffer();
                while (match.find()) match.appendReplacement(text, java.util.regex.Matcher.quoteReplacement(fields.get(match.group(1))));
                match.appendTail(text); ((ObjectNode) element).put("text", text.toString());
            }
            RecceBookCoverValidator.validate(cover);
            return cover;
        }
        item(elements, pec.getRally().getName(), 0, 20, true);
        item(elements, "PEC " + pec.getNumber() + " — " + pec.getName(), 22, 16, true);
        item(elements, "Equipa: " + (team == null || team.getName().isEmpty() ? "—" : team.getName()), 48, 12, false);
        item(elements, "Carro: " + car, 66, 12, false);
        item(elements, "Data do caderno: " + LocalDate.now(), 82, 12, false);
        ObjectNode back = root.putObject("back"); back.put("background", "#ffffff"); back.putArray("elements");
        return root;
    }
    private void item(ArrayNode elements, String text, int y, int fontPt, boolean bold) {
        ObjectNode item = elements.addObject(); item.put("text", text); item.put("x", 0); item.put("y", y); item.put("width", 100);
        item.put("fontPt", fontPt); item.put("font", "Arial"); item.put("align", "center"); item.put("bold", bold);
        item.put("italic", false); item.put("underline", false); item.put("color", "#000000");
    }
}
