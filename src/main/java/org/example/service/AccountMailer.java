package org.example.service;

public interface AccountMailer {
    boolean isConfigured();
    void send(String email, String purpose, String token);
}
