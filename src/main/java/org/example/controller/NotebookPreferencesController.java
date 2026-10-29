package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.entity.NotebookPreferencesEntity;
import org.example.repository.AuthUserRepository;
import org.example.repository.NotebookPreferencesRepository;
import org.example.service.NotebookPreferencesValidator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notebook-preferences")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.PUT, RequestMethod.OPTIONS})
public class NotebookPreferencesController {
    private final NotebookPreferencesRepository preferences;
    private final AuthUserRepository users;
    private final TenantContext tenant;
    private final ObjectMapper json;

    public NotebookPreferencesController(NotebookPreferencesRepository preferences, AuthUserRepository users,
                                         TenantContext tenant, ObjectMapper json) {
        this.preferences = preferences;
        this.users = users;
        this.tenant = tenant;
        this.json = json;
    }

    private String userId() {
        return users.findByEmailIgnoreCase(tenant.requireUserEmail())
                .orElseThrow(() -> new IllegalStateException("Conta indisponível.")).getId();
    }

    @GetMapping
    public ResponseEntity<JsonNode> get() throws com.fasterxml.jackson.core.JsonProcessingException {
        NotebookPreferencesEntity saved = preferences.findById(userId()).orElse(null);
        return saved == null ? ResponseEntity.noContent().cacheControl(org.springframework.http.CacheControl.noStore()).build()
                : ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                    .body(json.readTree(saved.getSettings()));
    }

    @PutMapping
    public ResponseEntity<JsonNode> save(@RequestBody JsonNode value) {
        NotebookPreferencesValidator.validate(value);
        NotebookPreferencesEntity saved = new NotebookPreferencesEntity();
        saved.setUserId(userId());
        saved.setSettings(value.toString());
        preferences.save(saved);
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(value);
    }
}
