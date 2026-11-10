package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.example.service.CrewService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/crews")
@CrossOrigin(origins="*",allowedHeaders="*",methods={RequestMethod.GET,RequestMethod.POST,RequestMethod.OPTIONS})
public class CrewController {
    private final CrewService crews;
    private final TenantContext context;
    public CrewController(CrewService crews,TenantContext context) { this.crews=crews; this.context=context; }
    @GetMapping public ResponseEntity<?> list() { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(crews.list(context.requireAccountId())); }
    @PostMapping public ResponseEntity<?> create(@RequestBody JsonNode body,@RequestHeader(value="Idempotency-Key",required=false) String key) {
        if (!body.isObject() || body.size()!=1 || !body.path("name").isTextual()) throw new IllegalArgumentException("Indica apenas o nome da tripulação.");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(crews.create(context.requireAccountId(),body.get("name").asText(),key));
    }
    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<?> persistenceFailure() { return ResponseEntity.status(503).cacheControl(CacheControl.noStore()).body(java.util.Collections.singletonMap("message","Não foi possível concluir o pedido. Tenta novamente.")); }
}
