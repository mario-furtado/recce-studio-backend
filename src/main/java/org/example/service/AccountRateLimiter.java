package org.example.service;

import org.example.entity.AccountRateLimitEntity;
import org.example.repository.AccountRateLimitRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.http.HttpStatus;
import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;
import javax.annotation.PostConstruct;

/** Persistent sliding windows, serialized across JVMs by a short database lock. */
@Service
public class AccountRateLimiter {
    public static final String GUARD = "!guard";
    private final AccountRateLimitRepository limits;
    private final org.example.repository.AccountChallengeRepository challenges;
    private final Clock clock;
    private final int maximum;
    public AccountRateLimiter(AccountRateLimitRepository limits, org.example.repository.AccountChallengeRepository challenges, Clock clock, @Value("${recce.account.rate-limit.limit:5}") int maximum) {
        if (maximum < 1 || maximum > 1000) throw new IllegalArgumentException("Limite de pedidos inválido.");
        this.limits = limits; this.challenges = challenges; this.clock = clock; this.maximum = maximum;
    }
    @PostConstruct public void initialize() {
        if (!limits.existsById(GUARD)) {
            try { limits.saveAndFlush(new AccountRateLimitEntity(GUARD)); }
            catch (org.springframework.dao.DataIntegrityViolationException ex) { if (!limits.existsById(GUARD)) throw ex; }
        }
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void check(String action, String email, String ip) {
        limits.lock(GUARD).orElseThrow(() -> new IllegalStateException("Proteção de pedidos indisponível."));
        long now = clock.millis();
        challenges.deleteExpired(now);
        limits.deleteExpired(now - 900000L);
        List<AccountRateLimitEntity> records = new ArrayList<>();
        for (String subject : Arrays.asList("email:" + email, "ip:" + ip)) {
            String key = AccountPasswords.digest(action + ":" + subject);
            AccountRateLimitEntity row = limits.findById(key).orElseGet(() -> new AccountRateLimitEntity(key));
            List<Long> recent = Arrays.stream(row.attempts.split(",")).filter(s -> !s.isEmpty()).map(Long::valueOf)
                .filter(t -> t > now - 900000L).collect(Collectors.toList());
            if (recent.size() >= maximum) throw new AccountFlowException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados pedidos. Tenta novamente dentro de 15 minutos.");
            recent.add(now); row.attempts = recent.stream().map(String::valueOf).collect(Collectors.joining(",")); row.lastAttemptAt = now; records.add(row);
        }
        limits.saveAll(records);
    }
}
