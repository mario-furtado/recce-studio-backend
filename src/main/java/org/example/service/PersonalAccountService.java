package org.example.service;

import org.example.entity.*;
import org.example.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.mail.MailException;
import java.time.Clock;
import java.security.SecureRandom;
import java.util.*;

@Service
public class PersonalAccountService {
    private final AuthUserRepository users;
    private final AccountChallengeRepository challenges;
    private final AccountRateLimitRepository limits;
    private final AccountMailer mailer;
    private final Clock clock;
    private final boolean enabled;
    private final SecureRandom random = new SecureRandom();
    public PersonalAccountService(AuthUserRepository users, AccountChallengeRepository challenges, AccountRateLimitRepository limits, AccountMailer mailer, Clock clock, @Value("${recce.account.enabled:false}") boolean enabled) {
        this.users = users; this.challenges = challenges; this.limits = limits; this.mailer = mailer; this.clock = clock; this.enabled = enabled;
    }
    public boolean available() { return enabled && mailer.isConfigured(); }
    public void requireAvailable() {
        if (!enabled) throw new AccountFlowException(HttpStatus.FORBIDDEN, "Registo e recuperação indisponíveis neste momento.");
        if (!mailer.isConfigured()) throw new AccountFlowException(HttpStatus.SERVICE_UNAVAILABLE, "O serviço de email não está disponível. Tenta mais tarde.");
    }
    public String normalizeEmail(String email) {
        String result = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (result.length() > 254 || !result.matches("[^\\s@\\p{Cntrl}]+@[^\\s@\\p{Cntrl}]+\\.[^\\s@\\p{Cntrl}]+")) throw new IllegalArgumentException("Indica um email válido.");
        try {
            javax.mail.internet.InternetAddress address = new javax.mail.internet.InternetAddress(result, true);
            address.validate();
            if (!result.equals(address.getAddress())) throw new IllegalArgumentException("Indica um email válido.");
        } catch (javax.mail.internet.AddressException ex) { throw new IllegalArgumentException("Indica um email válido."); }
        return result;
    }
    private String nonce() {
        byte[] bytes = new byte[32]; random.nextBytes(bytes); StringBuilder value = new StringBuilder();
        for (byte b : bytes) value.append(String.format("%02x", b & 255)); return value.toString();
    }
    @Transactional
    public void request(String purpose, String email) {
        requireAvailable();
        // Same delivery and public response for existing/non-existing/inactive accounts.
        // VERIFY never resets an existing account; RESET is bound to the account/version now.
        AuthUserEntity user = users.findByEmailIgnoreCase(email).orElse(null);
        AccountChallengeEntity challenge = new AccountChallengeEntity();
        String token = nonce(); challenge.tokenHash = AccountPasswords.digest(token); challenge.email = email; challenge.purpose = purpose;
        challenge.expiresAt = Math.addExact(clock.millis(), "VERIFY".equals(purpose) ? 86400000L : 1800000L);
        if ("RESET".equals(purpose) && user != null && user.isActive()) {
            challenge.userId = user.getId(); challenge.credentialVersion = version(user);
        }
        challenges.save(challenge);
        try { mailer.send(email, purpose, token); }
        catch (MailException ex) {
            // Never return account-dependent SMTP failures or expose provider messages/tokens.
            // An undelivered proof is invalidated; client can retry with the same generic flow.
            challenges.delete(challenge);
        }
    }
    public String limitSubject(String token) {
        if (token == null || !token.matches("[a-f0-9]{64}")) return "invalid-link";
        return challenges.findById(AccountPasswords.digest(token)).map(c -> c.email).orElse("invalid-link");
    }
    @Transactional
    public void confirm(String purpose, String token, String password) {
        requireAvailable();
        // Serialize first-account creation and proof consumption across instances, not a JVM flag.
        limits.lock(AccountRateLimiter.GUARD).orElseThrow(() -> new IllegalStateException("Proteção de pedidos indisponível."));
        if (token == null || !token.matches("[a-f0-9]{64}")) throw invalid();
        AccountChallengeEntity challenge = challenges.findById(AccountPasswords.digest(token)).orElseThrow(this::invalid);
        if (challenge.used || !purpose.equals(challenge.purpose) || challenge.expiresAt <= clock.millis()) throw invalid();
        if ("VERIFY".equals(purpose)) {
            if (users.existsByEmailIgnoreCase(challenge.email)) throw invalid();
            AuthUserEntity user = new AuthUserEntity(); user.setId(UUID.randomUUID().toString()); user.setEmail(challenge.email);
            user.setPasswordHash(AccountPasswords.encode(password)); user.setEmailVerified(true); user.setCredentialVersion(1L);
            user.setToken(nonce()); user.setTokenExpiresAtEpochMillis(null); users.save(user);
        } else {
            AuthUserEntity user = challenge.userId == null ? null : users.lockById(challenge.userId).orElse(null);
            if (user == null || !user.isActive() || !user.getEmail().equalsIgnoreCase(challenge.email) || version(user) != challenge.credentialVersion) throw invalid();
            user.setPasswordHash(AccountPasswords.encode(password)); user.setCredentialVersion(Math.addExact(version(user), 1));
            user.setTokenExpiresAtEpochMillis(null); users.save(user);
        }
        challenge.used = true; challenges.save(challenge);
    }
    private long version(AuthUserEntity user) { return user.getCredentialVersion() == null ? 0 : user.getCredentialVersion(); }
    private AccountFlowException invalid() { return new AccountFlowException(HttpStatus.BAD_REQUEST, "O link não é válido ou expirou. Pede um novo link."); }
}
