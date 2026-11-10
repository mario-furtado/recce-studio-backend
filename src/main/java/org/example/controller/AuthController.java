package org.example.controller;

import org.example.dto.AuthRequestDTO;
import org.example.dto.AuthResponseDTO;
import org.example.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.OPTIONS})
public class AuthController {
    private final AuthService authService;
    private final org.example.service.AccountRateLimiter limiter;

    public AuthController(AuthService authService, org.example.service.AccountRateLimiter limiter) {
        this.authService = authService;
        this.limiter = limiter;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponseDTO> login(@RequestBody AuthRequestDTO request, javax.servlet.http.HttpServletRequest http) {
        String email = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase(java.util.Locale.ROOT);
        limiter.check("LOGIN", email, http.getRemoteAddr());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(authService.login(request));
    }

    @GetMapping("/validate")
    public ResponseEntity<Void> validate(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.status(authService.isTokenValid(extractToken(authorization)) ? 200 : 401)
                .cacheControl(CacheControl.noStore()).build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String token = extractToken(authorization);
        if (token == null || token.isEmpty()) {
            return ResponseEntity.status(401).cacheControl(CacheControl.noStore()).build();
        }
        authService.logout(token);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    private String extractToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        return authorization.substring("Bearer ".length()).trim();
    }
}
