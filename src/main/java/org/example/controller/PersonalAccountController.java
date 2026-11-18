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
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PATCH, RequestMethod.OPTIONS})
public class PersonalAccountController {
    private final PersonalAccountService accounts;
    private final AccountRateLimiter limiter;
    private final AuthService auth;
    private final CrewService crews;
    private final CrewTransferService transfers;
    public PersonalAccountController(PersonalAccountService accounts, AccountRateLimiter limiter, AuthService auth, CrewService crews, CrewTransferService transfers) {
        this.accounts = accounts; this.limiter = limiter; this.auth = auth; this.crews=crews; this.transfers=transfers;
    }
    @GetMapping("/account-options")
    public ResponseEntity<?> options() { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Collections.singletonMap("available", accounts.available())); }
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody JsonNode body, HttpServletRequest request) {
        accounts.requireAvailable();
        fields(body, "email", "password", "displayName", "dateOfBirth");
        String email = accounts.normalizeEmail(text(body, "email"));
        limiter.check("VERIFY_REQUEST", email, request.getRemoteAddr());
        return registrationResponse(accounts.beginRegistration(email, text(body, "password"),
                text(body, "displayName"), text(body, "dateOfBirth")));
    }

    @PostMapping("/registration/resend")
    public ResponseEntity<?> resendRegistration(@RequestBody JsonNode body, HttpServletRequest request) {
        accounts.requireAvailable();
        fields(body, "requestId", "email");
        String requestId = text(body, "requestId");
        String email = body.has("email") ? accounts.normalizeEmail(text(body, "email")) : null;
        limiter.check("VERIFY_REQUEST", email == null ? accounts.registrationSubject(requestId) : email, request.getRemoteAddr());
        return registrationResponse(accounts.resendRegistration(requestId, email));
    }

    @PostMapping("/registration/confirm")
    public ResponseEntity<?> confirmRegistration(@RequestBody JsonNode body, HttpServletRequest request) {
        accounts.requireAvailable();
        fields(body, "requestId", "code");
        String requestId = text(body, "requestId");
        limiter.check("VERIFY_CONFIRM", accounts.registrationSubject(requestId), request.getRemoteAddr());
        String email = accounts.confirmRegistration(requestId, text(body, "code"));
        accounts.sendWelcome(email);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    private ResponseEntity<?> registrationResponse(PersonalAccountService.RegistrationDelivery delivery) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("requestId", delivery.requestId);
        body.put("remainingSeconds", accounts.sendRegistrationCode(delivery));
        return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(body);
    }
    @PostMapping("/password-reset/request")
    public ResponseEntity<?> resetRequest(@RequestBody JsonNode body, HttpServletRequest request) {
        accounts.requireAvailable();
        fields(body, "email"); String email = accounts.normalizeEmail(text(body, "email"));
        limiter.check("RESET_REQUEST", email, request.getRemoteAddr());
        accounts.requestPasswordReset(email);
        return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(Collections.singletonMap("message", "Se o pedido for aplicável, receberás um email com instruções. Se não chegar, tenta novamente mais tarde."));
    }
    @PostMapping("/verify-email")
    public ResponseEntity<?> verify(@RequestBody JsonNode body, HttpServletRequest request) { return confirm("VERIFY", body, request); }
    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> reset(@RequestBody JsonNode body, HttpServletRequest request) { return confirm("RESET", body, request); }
    private ResponseEntity<?> confirm(String purpose, JsonNode body, HttpServletRequest request) {
        boolean verification = "VERIFY".equals(purpose);
        if (verification) fields(body, "token", "password", "displayName", "dateOfBirth");
        else fields(body, "token", "password");
        String token = text(body, "token");
        limiter.check(purpose + "_CONFIRM", accounts.limitSubject(token), request.getRemoteAddr());
        accounts.confirm(purpose, token, text(body, "password"),
                verification ? text(body, "displayName") : null, verification ? text(body, "dateOfBirth") : null);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        AuthUserEntity user = requireAccount(bearer(authorization));
        Map<String, Object> result = new LinkedHashMap<>(); result.put("id", user.getId()); result.put("email", user.getEmail());
        result.putAll(personalDetails(user));
        result.put("emailVerified", Boolean.TRUE.equals(user.getEmailVerified())); result.put("hasWorkspace", org.springframework.util.StringUtils.hasText(auth.getWorkspaceTeamProfileId(user)));
        result.put("crewsEnabled",crews.enabled());
        result.put("deactivationAvailable", accounts.deactivationAvailable(user));
        result.put("crewTransfersEnabled", transfers.enabled());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
    }

    @PatchMapping("/me")
    public ResponseEntity<?> updateMe(@RequestHeader(value = "Authorization", required = false) String authorization,
                                      @RequestBody JsonNode body) {
        String token = bearer(authorization);
        AuthUserEntity user = requireAccount(token);
        fields(body, "displayName", "dateOfBirth");
        AuthUserEntity updated = accounts.updatePersonalDetails(user.getId(), token, text(body, "displayName"), text(body, "dateOfBirth"));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(personalDetails(updated));
    }

    private Map<String, Object> personalDetails(AuthUserEntity user) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("displayName", user.getDisplayName());
        result.put("dateOfBirth", user.getDateOfBirth() == null ? null : user.getDateOfBirth().toString());
        return result;
    }

    @PostMapping("/deactivate")
    public ResponseEntity<?> deactivate(@RequestHeader(value = "Authorization", required = false) String authorization,
                                        @RequestBody JsonNode body, HttpServletRequest request) {
        String token = bearer(authorization);
        AuthUserEntity user = requireAccount(token);
        fields(body, "password");
        String password = text(body, "password");
        limiter.check("DEACTIVATE", user.getEmail(), request.getRemoteAddr());
        accounts.deactivate(user.getId(), token, password);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    private String bearer(String authorization) {
        return authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7).trim() : null;
    }

    private AuthUserEntity requireAccount(String token) {
        if (auth.isTokenValid(token)) {
            return auth.findActiveUserByToken(token)
                    .orElseThrow(() -> new AccountFlowException(HttpStatus.UNAUTHORIZED, "Sessão inválida ou expirada."));
        }
        throw new AccountFlowException(HttpStatus.UNAUTHORIZED, "Sessão inválida ou expirada.");
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
