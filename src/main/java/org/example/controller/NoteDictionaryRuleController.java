package org.example.controller;

import org.example.dto.NoteDictionaryRuleDTO;
import org.example.service.AuthService;
import org.example.service.NoteDictionaryRuleService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/note-dictionary-rules")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class NoteDictionaryRuleController {
    private final NoteDictionaryRuleService noteDictionaryRuleService;
    private final AuthService authService;

    public NoteDictionaryRuleController(NoteDictionaryRuleService noteDictionaryRuleService, AuthService authService) {
        this.noteDictionaryRuleService = noteDictionaryRuleService;
        this.authService = authService;
    }

    @GetMapping
    public ResponseEntity<List<NoteDictionaryRuleDTO>> list(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok(noteDictionaryRuleService.list(resolveUserEmail(authorization)));
    }

    @PostMapping
    public ResponseEntity<NoteDictionaryRuleDTO> create(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody NoteDictionaryRuleDTO dto) {
        return ResponseEntity.ok(noteDictionaryRuleService.create(resolveUserEmail(authorization), dto));
    }

    @PatchMapping("/{ruleId}")
    public ResponseEntity<NoteDictionaryRuleDTO> update(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String ruleId,
            @RequestBody NoteDictionaryRuleDTO dto) {
        return ResponseEntity.ok(noteDictionaryRuleService.update(resolveUserEmail(authorization), ruleId, dto));
    }

    @DeleteMapping("/{ruleId}")
    public ResponseEntity<Void> delete(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String ruleId) {
        noteDictionaryRuleService.delete(resolveUserEmail(authorization), ruleId);
        return ResponseEntity.noContent().build();
    }

    private String resolveUserEmail(String authorization) {
        return authService.getEmailFromAuthorization(authorization);
    }
}
