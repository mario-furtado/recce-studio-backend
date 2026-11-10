package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.example.service.RallyInvitationService;
import org.example.service.RallyInvitationService.Inbox;
import org.example.service.RallyInvitationService.InvitationView;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class RallyInvitationController {
    private final RallyInvitationService invitations;
    private final TenantContext tenant;

    public RallyInvitationController(RallyInvitationService invitations, TenantContext tenant) {
        this.invitations = invitations;
        this.tenant = tenant;
    }

    @GetMapping("/invitations/options")
    public Map<String, Boolean> options() {
        return Collections.singletonMap("enabled", invitations.enabled());
    }

    @GetMapping("/rallies/{rallyId}/invitations")
    public Inbox sent(@PathVariable String rallyId, @RequestParam(defaultValue = "0") int page) {
        return invitations.sent(tenant.requireAccountId(), rallyId, page);
    }

    @PostMapping("/rallies/{rallyId}/invitations")
    public ResponseEntity<Map<String, String>> send(@PathVariable String rallyId, @RequestBody JsonNode request) {
        if (!request.isObject() || request.size() != 1 || !request.path("email").isTextual()) {
            throw new IllegalArgumentException("Indica apenas o email do destinatário.");
        }
        invitations.send(tenant.requireAccountId(), rallyId, request.path("email").asText());
        return ResponseEntity.accepted().body(Collections.singletonMap("message",
                "Pedido recebido. O convite fica disponível na aplicação para quem verificar este endereço."));
    }

    @PostMapping("/rallies/{rallyId}/invitations/{id}/cancel")
    public ResponseEntity<Void> cancel(@PathVariable String rallyId, @PathVariable String id) {
        invitations.cancel(tenant.requireAccountId(), rallyId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/notifications")
    public Inbox inbox(@RequestParam(defaultValue = "0") int page) {
        return invitations.received(tenant.requireAccountId(), page);
    }

    @GetMapping("/notifications/unread")
    public Map<String, Long> unread() {
        return Collections.singletonMap("unread", invitations.unread(tenant.requireAccountId()));
    }

    @GetMapping("/invitations/{id}")
    public InvitationView detail(@PathVariable String id) {
        return invitations.detail(tenant.requireAccountId(), id);
    }

    @PatchMapping("/notifications/{id}/read")
    public InvitationView markRead(@PathVariable String id) {
        return invitations.respond(tenant.requireAccountId(), id, RallyInvitationService.Action.READ);
    }

    @PostMapping("/invitations/{id}/accept")
    public InvitationView accept(@PathVariable String id) {
        return invitations.respond(tenant.requireAccountId(), id, RallyInvitationService.Action.ACCEPT);
    }

    @PostMapping("/invitations/{id}/decline")
    public InvitationView decline(@PathVariable String id) {
        return invitations.respond(tenant.requireAccountId(), id, RallyInvitationService.Action.DECLINE);
    }
}
