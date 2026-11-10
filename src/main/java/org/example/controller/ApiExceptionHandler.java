package org.example.controller;

import org.example.dto.ErrorResponseDTO;
import org.example.service.ResourceNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(org.example.service.AccountFlowException.class)
    public ResponseEntity<ErrorResponseDTO> handleAccountFlow(org.example.service.AccountFlowException exception) {
        org.springframework.http.ResponseEntity.BodyBuilder builder = ResponseEntity.status(exception.status).cacheControl(org.springframework.http.CacheControl.noStore());
        if (exception.status == HttpStatus.TOO_MANY_REQUESTS) builder.header("Retry-After", Long.toString(exception.retryAfterSeconds));
        return builder.body(new ErrorResponseDTO(exception.getMessage()));
    }
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponseDTO> handleNotFound(ResourceNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponseDTO(exception.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponseDTO> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponseDTO(exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponseDTO> handleIllegalState(IllegalStateException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponseDTO(exception.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponseDTO> handleRuntime(RuntimeException exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponseDTO(exception.getMessage()));
    }
}
