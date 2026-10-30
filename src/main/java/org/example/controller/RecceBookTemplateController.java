package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.example.entity.RecceBookTemplateEntity;
import org.example.repository.AuthUserRepository;
import org.example.repository.RecceBookTemplateRepository;
import org.example.service.RecceBookCoverValidator;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reccebook-template")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.PUT, RequestMethod.OPTIONS})
public class RecceBookTemplateController {
    private final RecceBookTemplateRepository templates;
    private final AuthUserRepository users;
    private final TenantContext tenant;
    private final ObjectMapper json;
    public RecceBookTemplateController(RecceBookTemplateRepository templates, AuthUserRepository users, TenantContext tenant, ObjectMapper json) {
        this.templates = templates; this.users = users; this.tenant = tenant; this.json = json;
    }
    private String userId() {
        return users.findByEmailIgnoreCase(tenant.requireUserEmail()).orElseThrow(() -> new IllegalStateException("Conta indisponível.")).getId();
    }
    @GetMapping
    public ResponseEntity<JsonNode> get() throws Exception {
        RecceBookTemplateEntity saved = templates.findById(userId()).orElse(null);
        ObjectNode response = json.createObjectNode();
        response.set("cover", saved == null ? initial() : json.readTree(saved.getCover()));
        response.put("editable", true);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(response);
    }
    @PutMapping
    public ResponseEntity<JsonNode> save(@RequestBody JsonNode value) {
        String id = userId();
        RecceBookCoverValidator.validate(value);
        RecceBookTemplateEntity saved = new RecceBookTemplateEntity();
        saved.setUserId(id); saved.setCover(value.toString()); templates.save(saved);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);
    }
    private ObjectNode initial() {
        ObjectNode value = json.createObjectNode(); value.put("version", 1);
        ObjectNode front = value.putObject("front"); front.put("background", "#ffffff");
        ArrayNode elements = front.putArray("elements");
        String[] texts = {"{{rali}}", "{{pec}}", "Equipa: {{equipa}}", "Carro: {{carro}}", "Data do caderno: {{data}}"};
        int[] ys = {0, 22, 48, 66, 82};
        for (int i = 0; i < texts.length; i++) {
            ObjectNode item = elements.addObject(); item.put("text", texts[i]); item.put("x", 0); item.put("y", ys[i]); item.put("width", 100);
            item.put("fontPt", i == 0 ? 20 : i == 1 ? 16 : 12); item.put("font", "Arial"); item.put("align", "center");
            item.put("bold", i < 2); item.put("italic", false); item.put("underline", false); item.put("color", "#000000");
        }
        ObjectNode back = value.putObject("back"); back.put("background", "#ffffff"); back.putArray("elements");
        return value;
    }
}
