package org.example.service;

import org.example.entity.*;
import org.example.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.mail.MailException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.security.SecureRandom;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.persistence.EntityManager;

@Service
public class PersonalAccountService {
    private static final String REGISTRATION = "REGISTRATION";
    private static final long CODE_TTL = 5 * 60 * 1000L;
    private static final long PENDING_TTL = 30 * 60 * 1000L;
    private final AuthUserRepository users;
    private final AccountChallengeRepository challenges;
    private final AccountRateLimitRepository limits;
    private final AccountMailer mailer;
    private final Clock clock;
    private final boolean enabled;
    private final EntityManager entities;
    private final SecureRandom random = new SecureRandom();
    public PersonalAccountService(AuthUserRepository users, AccountChallengeRepository challenges, AccountRateLimitRepository limits, AccountMailer mailer, Clock clock, EntityManager entities, @Value("${recce.account.enabled:false}") boolean enabled) {
        this.users = users; this.challenges = challenges; this.limits = limits; this.mailer = mailer; this.clock = clock; this.enabled = enabled;
        this.entities = entities;
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
    public RegistrationDelivery beginRegistration(String email, String password, String name, String dateOfBirth) {
        requireAvailable();
        AuthUserEntity details = new AuthUserEntity();
        applyPersonalDetails(details, name, dateOfBirth);
        String requestId = nonce();
        AccountChallengeEntity pending = new AccountChallengeEntity();
        pending.tokenHash = AccountPasswords.digest(requestId);
        pending.purpose = REGISTRATION;
        pending.email = email;
        pending.pendingDisplayName = details.getDisplayName();
        pending.pendingDateOfBirth = details.getDateOfBirth();
        pending.pendingPasswordHash = AccountPasswords.encode(password);
        return issueRegistrationCode(pending, requestId);
    }

    @Transactional
    public RegistrationDelivery resendRegistration(String requestId, String correctedEmail) {
        requireAvailable();
        lockAccountChanges();
        AccountChallengeEntity pending = pendingRegistration(requestId);
        if (correctedEmail != null) pending.email = correctedEmail;
        return issueRegistrationCode(pending, requestId);
    }

    private RegistrationDelivery issueRegistrationCode(AccountChallengeEntity pending, String requestId) {
        String code;
        String digest;
        do {
            code = String.format(Locale.ROOT, "%06d", random.nextInt(1000000));
            digest = registrationCodeDigest(requestId, code);
        } while (digest.equals(pending.registrationCodeHash));
        long now = clock.millis();
        pending.registrationCodeHash = digest;
        pending.registrationCodeExpiresAt = now + CODE_TTL;
        pending.expiresAt = now + PENDING_TTL;
        challenges.save(pending);
        return new RegistrationDelivery(requestId, pending.email, code, pending.registrationCodeExpiresAt);
    }

    public String registrationSubject(String requestId) {
        requireAvailable();
        if (!requestId.matches("[a-f0-9]{64}")) throw expiredRegistration();
        return challenges.pendingEmail(AccountPasswords.digest(requestId), REGISTRATION, clock.millis())
                .orElseThrow(this::expiredRegistration);
    }

    private AccountChallengeEntity pendingRegistration(String requestId) {
        if (requestId == null || !requestId.matches("[a-f0-9]{64}")) throw expiredRegistration();
        return challenges.findById(AccountPasswords.digest(requestId))
                .filter(pending -> REGISTRATION.equals(pending.purpose) && !pending.used && pending.expiresAt > clock.millis())
                .orElseThrow(this::expiredRegistration);
    }

    private static String registrationCodeDigest(String requestId, String code) {
        return AccountPasswords.digest(REGISTRATION + ":" + requestId + ":" + code);
    }

    @Transactional
    public String confirmRegistration(String requestId, String code) {
        requireAvailable();
        lockAccountChanges();
        AccountChallengeEntity pending = pendingRegistration(requestId);
        if (pending.registrationCodeExpiresAt <= clock.millis()) {
            throw new AccountFlowException(HttpStatus.BAD_REQUEST, "O código expirou. Pede um novo código.");
        }
        if (!code.matches("[0-9]{6}") || !MessageDigest.isEqual(
                pending.registrationCodeHash.getBytes(StandardCharsets.US_ASCII),
                registrationCodeDigest(requestId, code).getBytes(StandardCharsets.US_ASCII))
                || users.existsByEmailIgnoreCase(pending.email)) {
            throw new AccountFlowException(HttpStatus.BAD_REQUEST, "Não foi possível confirmar o código. Verifica-o ou recupera o acesso se já tens conta.");
        }
        AuthUserEntity user = new AuthUserEntity();
        user.updatePersonalDetails(pending.pendingDisplayName, pending.pendingDateOfBirth);
        saveVerifiedAccount(user, pending.email, pending.pendingPasswordHash);
        challenges.delete(pending);
        return pending.email;
    }

    private AccountFlowException expiredRegistration() {
        return new AccountFlowException(HttpStatus.GONE, "O pedido de registo expirou. Volta a preencher o formulário.");
    }

    @Transactional
    public long sendRegistrationCode(RegistrationDelivery delivery) {
        try {
            mailer.send(delivery.email, "VERIFY_CODE", delivery.code);
        } catch (MailException ex) {
            lockAccountChanges();
            challenges.expireRegistrationCode(AccountPasswords.digest(delivery.requestId),
                    registrationCodeDigest(delivery.requestId, delivery.code), clock.millis());
            return 0;
        }
        return Math.max(0, (delivery.expiresAt - clock.millis() + 999) / 1000);
    }

    public void sendWelcome(String email) {
        try {
            mailer.send(email, "WELCOME", "");
        } catch (MailException ex) {
            // The account is already committed and can be used.
        }
    }

    public static final class RegistrationDelivery {
        public final String requestId;
        private final String email;
        private final String code;
        private final long expiresAt;

        private RegistrationDelivery(String requestId, String email, String code, long expiresAt) {
            this.requestId = requestId;
            this.email = email;
            this.code = code;
            this.expiresAt = expiresAt;
        }
    }
    @Transactional
    public void requestPasswordReset(String email) {
        requireAvailable();
        AuthUserEntity user = users.findByEmailIgnoreCase(email).orElse(null);
        AccountChallengeEntity challenge = new AccountChallengeEntity();
        String token = nonce(); challenge.tokenHash = AccountPasswords.digest(token); challenge.email = email; challenge.purpose = "RESET";
        challenge.expiresAt = Math.addExact(clock.millis(), 1800000L);
        if (user != null && canRecover(user)) {
            challenge.userId = user.getId(); challenge.credentialVersion = version(user);
        }
        challenges.save(challenge);
        try { mailer.send(email, "RESET", token); }
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
    public void confirm(String purpose, String token, String password, String displayName, String dateOfBirth) {
        requireAvailable();
        // Serialize first-account creation and proof consumption across instances, not a JVM flag.
        lockAccountChanges();
        if (token == null || !token.matches("[a-f0-9]{64}")) throw invalid();
        AccountChallengeEntity challenge = challenges.findById(AccountPasswords.digest(token)).orElseThrow(this::invalid);
        if (challenge.used || !purpose.equals(challenge.purpose) || challenge.expiresAt <= clock.millis()) throw invalid();
        if ("VERIFY".equals(purpose)) {
            if (users.existsByEmailIgnoreCase(challenge.email)) throw invalid();
            AuthUserEntity user = new AuthUserEntity();
            applyPersonalDetails(user, displayName, dateOfBirth);
            saveVerifiedAccount(user, challenge.email, AccountPasswords.encode(password));
        } else {
            AuthUserEntity user = challenge.userId == null ? null : users.lockById(challenge.userId).orElse(null);
            if (user == null || !canRecover(user) || !user.getEmail().equalsIgnoreCase(challenge.email) || version(user) != challenge.credentialVersion) throw invalid();
            user.setPasswordHash(AccountPasswords.encode(password)); user.setCredentialVersion(Math.addExact(version(user), 1));
            user.setTokenExpiresAtEpochMillis(null);
            user.setSelfDeactivatedAt(null);
            user.setActive(true);
            users.save(user);
        }
        challenge.used = true; challenges.save(challenge);
    }

    private void lockAccountChanges() {
        limits.lock(AccountRateLimiter.GUARD).orElseThrow(() -> new IllegalStateException("Proteção de pedidos indisponível."));
    }

    private void saveVerifiedAccount(AuthUserEntity user, String email, String passwordHash) {
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPasswordHash(passwordHash);
        user.setEmailVerified(true);
        user.setCredentialVersion(1L);
        user.setToken(nonce());
        user.setTokenExpiresAtEpochMillis(null);
        users.save(user);
    }

    @Transactional
    public AuthUserEntity updatePersonalDetails(String accountId, String token, String displayName, String dateOfBirth) {
        AuthUserEntity user = requireCurrentSession(accountId, token);
        applyPersonalDetails(user, displayName, dateOfBirth);
        return user;
    }

    private void applyPersonalDetails(AuthUserEntity user, String displayName, String dateOfBirth) {
        String name = displayName.trim();
        if (!org.springframework.util.StringUtils.hasText(name) || name.length() > 120 || displayName.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("Indica um nome válido até 120 caracteres.");
        }
        LocalDate birthDate;
        try {
            if (!dateOfBirth.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw invalidBirthDate();
            birthDate = LocalDate.parse(dateOfBirth);
        } catch (DateTimeParseException ex) {
            throw invalidBirthDate();
        }
        LocalDate today = Instant.ofEpochMilli(clock.millis()).atOffset(ZoneOffset.UTC).toLocalDate();
        if (birthDate.getYear() < 1 || birthDate.isAfter(today)) throw invalidBirthDate();
        user.updatePersonalDetails(name, birthDate);
    }

    private IllegalArgumentException invalidBirthDate() {
        return new IllegalArgumentException("Indica uma data de nascimento válida que não seja futura.");
    }
    private long version(AuthUserEntity user) { return user.getCredentialVersion() == null ? 0 : user.getCredentialVersion(); }
    private boolean canRecover(AuthUserEntity user) {
        return user.isActive() || (user.getSelfDeactivatedAt() != null && Boolean.TRUE.equals(user.getEmailVerified()));
    }

    public boolean deactivationAvailable(AuthUserEntity user) {
        return available() && Boolean.TRUE.equals(user.getEmailVerified());
    }

    @Transactional
    public void deactivate(String accountId, String token, String password) {
        requireAvailable();
        AuthUserEntity user = requireCurrentSession(accountId, token);
        if (!Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new AccountFlowException(HttpStatus.FORBIDDEN, "É necessário um email verificado para poder reativar a conta.");
        }
        if (!AccountPasswords.matches(password, user.getPasswordHash())) {
            throw new AccountFlowException(HttpStatus.FORBIDDEN, "A password atual está incorreta.");
        }
        user.setCredentialVersion(Math.addExact(version(user), 1));
        user.setSelfDeactivatedAt(clock.millis());
        user.setActive(false);
        user.setTokenExpiresAtEpochMillis(null);
    }

    private AuthUserEntity requireCurrentSession(String accountId, String token) {
        AuthUserEntity user = users.lockById(accountId).orElseThrow(this::invalidSession);
        entities.refresh(user);
        Long expiry = user.getTokenExpiresAtEpochMillis();
        if (!user.isActive() || !token.equals(user.getToken()) || expiry == null || expiry <= clock.millis()) throw invalidSession();
        return user;
    }

    private AccountFlowException invalidSession() {
        return new AccountFlowException(HttpStatus.UNAUTHORIZED, "Sessão inválida ou expirada.");
    }
    private AccountFlowException invalid() { return new AccountFlowException(HttpStatus.BAD_REQUEST, "O link não é válido ou expirou. Pede um novo link."); }
}
