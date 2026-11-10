package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.example.entity.AuthUserEntity;
import org.example.service.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.OPTIONS})
public class PersonalAccountController {
    private final PersonalAccountService accounts;
    private final AccountRateLimiter limiter;
    private final AuthService auth;
    private final CrewService crews;
    public PersonalAccountController(PersonalAccountService accounts, AccountRateLimiter limiter, AuthService auth, CrewService crews) { this.accounts = accounts; this.limiter = limiter; this.auth = auth; this.crews=crews; }
    @GetMapping("/account-options")
    public ResponseEntity<?> options() { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Collections.singletonMap("available", accounts.available())); }
    @PostMapping({"/register", "/verification/request"})
    public ResponseEntity<?> register(@RequestBody JsonNode body, HttpServletRequest request) {
        // Preserve the closed-beta response before parsing any registration fields.
        accounts.requireAvailable();
        return request("VERIFY", body, request);
    }
    @PostMapping("/password-reset/request")
    public ResponseEntity<?> resetRequest(@RequestBody JsonNode body, HttpServletRequest request) {
        accounts.requireAvailable();
        return request("RESET", body, request);
    }
    private ResponseEntity<?> request(String purpose, JsonNode body, HttpServletRequest request) {
        fields(body, "email"); String email = accounts.normalizeEmail(text(body, "email"));
        limiter.check(purpose + "_REQUEST", email, request.getRemoteAddr()); accounts.request(purpose, email);
        return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(Collections.singletonMap("message", "Se o pedido for aplicável, receberás um email com instruções. Se não chegar, tenta novamente mais tarde."));
    }
    @PostMapping("/verify-email")
    public ResponseEntity<?> verify(@RequestBody JsonNode body, HttpServletRequest request) { return confirm("VERIFY", body, request); }
    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> reset(@RequestBody JsonNode body, HttpServletRequest request) { return confirm("RESET", body, request); }
    private ResponseEntity<?> confirm(String purpose, JsonNode body, HttpServletRequest request) {
        fields(body, "token", "password"); String token = text(body, "token");
        limiter.check(purpose + "_CONFIRM", accounts.limitSubject(token), request.getRemoteAddr()); accounts.confirm(purpose, token, text(body, "password"));
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String token = authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7).trim() : null;
        if (!auth.isTokenValid(token)) throw new AccountFlowException(HttpStatus.UNAUTHORIZED, "Sessão inválida ou expirada.");
        AuthUserEntity user = auth.findActiveUserByToken(token).orElseThrow(() -> new AccountFlowException(HttpStatus.UNAUTHORIZED, "Sessão inválida ou expirada."));
        Map<String, Object> result = new LinkedHashMap<>(); result.put("id", user.getId()); result.put("email", user.getEmail());
        result.put("emailVerified", Boolean.TRUE.equals(user.getEmailVerified())); result.put("hasWorkspace", org.springframework.util.StringUtils.hasText(auth.getWorkspaceTeamProfileId(user)));
        result.put("crewsEnabled",crews.enabled());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
    }
    private void fields(JsonNode value, String... fields) {
        if (value == null || !value.isObject()) throw new IllegalArgumentException("Pedido inválido.");
        value.fieldNames().forEachRemaining(key -> { if (!Arrays.asList(fields).contains(key)) throw new IllegalArgumentException("Pedido inválido."); });
    }
    private String text(JsonNode value, String field) {
        JsonNode item = value.path(field); if (!item.isTextual() || item.asText().length() > 512) throw new IllegalArgumentException("Pedido inválido."); return item.asText();
    }
    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<?> persistenceFailure() { return ResponseEntity.status(503).cacheControl(CacheControl.noStore()).body(Collections.singletonMap("message", "Não foi possível concluir o pedido. Tenta novamente mais tarde.")); }
}
