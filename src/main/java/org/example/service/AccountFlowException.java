package org.example.service;

import org.springframework.http.HttpStatus;

public class AccountFlowException extends RuntimeException {
    public final HttpStatus status;
    public final long retryAfterSeconds;
    public AccountFlowException(HttpStatus status, String message) { this(status, message, 900); }
    public AccountFlowException(HttpStatus status, String message, long retryAfterSeconds) {
        super(message);
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
