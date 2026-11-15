package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.example.service.CrewService;
import org.example.service.CrewTransferService;
import org.example.service.PersonalAccountService;
import org.example.service.AccountRateLimiter;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/crews")
@CrossOrigin(origins="*",allowedHeaders="*",methods={RequestMethod.GET,RequestMethod.POST,RequestMethod.OPTIONS})
public class CrewController {
    private final CrewService crews;
    private final TenantContext context;
    private final CrewTransferService transfers;
    private final PersonalAccountService accounts;
    private final AccountRateLimiter limiter;
    public CrewController(CrewService crews, TenantContext context, CrewTransferService transfers,
                          PersonalAccountService accounts, AccountRateLimiter limiter) {
        this.crews = crews;
        this.context = context;
        this.transfers = transfers;
        this.accounts = accounts;
        this.limiter = limiter;
    }
    @GetMapping public ResponseEntity<?> list() { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(crews.list(context.requireAccountId())); }
    @PostMapping public ResponseEntity<?> create(@RequestBody JsonNode body,@RequestHeader(value="Idempotency-Key",required=false) String key) {
        if (!body.isObject() || body.size()!=1 || !body.path("name").isTextual()) throw new IllegalArgumentException("Indica apenas o nome da tripulação.");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(crews.create(context.requireAccountId(),body.get("name").asText(),key));
    }

    @GetMapping("/transfers")
    public ResponseEntity<?> incoming(@RequestParam(defaultValue = "0") int page) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(transfers.incoming(context.requireAccountId(), page));
    }

    @PostMapping("/{id}/transfer")
    public ResponseEntity<?> requestTransfer(@PathVariable String id, @RequestBody JsonNode body, HttpServletRequest request) {
        String password = password(body, 2);
        String email = accounts.normalizeEmail(body.path("email").asText(""));
        limit(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(transfers.request(context.requireAccountId(), context.requireBearerToken(), id, email, password));
    }

    @PostMapping("/{id}/transfer/cancel")
    public ResponseEntity<?> cancelTransfer(@PathVariable String id, @RequestBody JsonNode body, HttpServletRequest request) {
        String password = password(body, 1);
        limit(request);
        transfers.cancel(context.requireAccountId(), context.requireBearerToken(), id, password);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @PostMapping("/transfers/{id}/accept")
    public ResponseEntity<?> acceptTransfer(@PathVariable String id, @RequestBody JsonNode body, HttpServletRequest request) {
        String password = password(body, 1);
        limit(request);
        transfers.accept(context.requireAccountId(), context.requireBearerToken(), id, password);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    private String password(JsonNode body, int size) {
        JsonNode value = body.path("password");
        if (!body.isObject() || body.size() != size || !value.isTextual() || value.asText().length() > 512)
            throw new IllegalArgumentException("Pedido inválido.");
        return value.asText();
    }

    private void limit(HttpServletRequest request) {
        limiter.check("CREW_TRANSFER", context.requireUserEmail(), request.getRemoteAddr());
    }
    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<?> persistenceFailure() { return ResponseEntity.status(503).cacheControl(CacheControl.noStore()).body(java.util.Collections.singletonMap("message","Não foi possível concluir o pedido. Tenta novamente.")); }
}
