package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.example.service.RallyInvitationService;
import org.example.service.RallyAccessService;
import org.example.entity.RallyAccessEventEntity;
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
    private final RallyAccessService access;

    public RallyInvitationController(RallyInvitationService invitations, TenantContext tenant, RallyAccessService access) {
        this.invitations = invitations;
        this.tenant = tenant;
        this.access = access;
    }

    @GetMapping("/rallies/{rallyId}/access")
    public RallyAccessService.AccessPage<RallyAccessService.GrantView> accesses(@PathVariable String rallyId,
                                                                                @RequestParam(defaultValue = "0") int page) {
        return access.list(tenant.requireAccountId(), rallyId, page);
    }

    @GetMapping("/rallies/{rallyId}/access/history")
    public RallyAccessService.AccessPage<RallyAccessEventEntity> history(@PathVariable String rallyId,
                                                                         @RequestParam(defaultValue = "0") int page) {
        return access.history(tenant.requireAccountId(), rallyId, page);
    }

    @PostMapping("/rallies/{rallyId}/access/{grantId}/revoke")
    public ResponseEntity<Void> revoke(@PathVariable String rallyId, @PathVariable long grantId, @RequestBody JsonNode request) {
        if (!request.isObject() || request.size() != 1 || !request.path("reason").isTextual()) {
            throw new IllegalArgumentException("Seleciona um motivo válido.");
        }
        RallyAccessService.Reason reason;
        try { reason = RallyAccessService.Reason.valueOf(request.path("reason").asText()); }
        catch (IllegalArgumentException ex) { throw new IllegalArgumentException("Seleciona um motivo válido."); }
        access.revoke(tenant.requireAccountId(), rallyId, grantId, reason);
        return ResponseEntity.noContent().build();
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
