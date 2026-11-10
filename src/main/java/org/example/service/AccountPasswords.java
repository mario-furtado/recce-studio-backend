package org.example.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.util.StringUtils;

/** Versioned prehash avoids BCrypt's 72-byte limit without changing legacy hashes. */
public final class AccountPasswords {
    private static final String PREFIX = "{bcrypt-sha256}";
    private static final String DUMMY = BCrypt.hashpw("non-account-placeholder", BCrypt.gensalt());
    private AccountPasswords() {}
    public static String digest(String value) {
        try { return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException("Hash indisponível."); }
    }
    public static String encode(String password) {
        int count = password == null ? 0 : password.codePointCount(0, password.length());
        if (!StringUtils.hasText(password) || count < 12 || count > 128) throw new IllegalArgumentException("Usa uma password de 12 a 128 caracteres.");
        return PREFIX + BCrypt.hashpw(digest(password), BCrypt.gensalt());
    }
    public static boolean matches(String password, String hash) {
        if (password == null || password.length() > 512) return false;
        if (hash == null) { BCrypt.checkpw(password, DUMMY); return false; }
        try { return hash.startsWith(PREFIX) ? BCrypt.checkpw(digest(password), hash.substring(PREFIX.length())) : BCrypt.checkpw(password, hash); }
        catch (IllegalArgumentException ex) { return false; }
    }
}
