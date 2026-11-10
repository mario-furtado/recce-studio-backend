package org.example.service;

import org.springframework.http.HttpStatus;

public class AccountFlowException extends RuntimeException {
    public final HttpStatus status;
    public AccountFlowException(HttpStatus status, String message) { super(message); this.status = status; }
}
