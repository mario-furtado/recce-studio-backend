package org.example.service;

import org.example.entity.RallyEntity;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.persistence.EntityManager;
import javax.persistence.LockModeType;
import javax.persistence.PersistenceContext;

@Component
public class RallyWriteGuard {
    @PersistenceContext
    private EntityManager entities;

    // Call with an authorized rally inside the transaction that performs the write.
    public void lock(RallyEntity rally) {
        entities.refresh(rally, LockModeType.PESSIMISTIC_WRITE);
    }

    public void requireWritable(RallyEntity rally) {
        lock(rally);
        if (rally.getArchivedAt() != null) {
            throw new AccountFlowException(HttpStatus.CONFLICT, "Rali arquivado. Restaura-o antes de fazer alterações ou sincronizar.");
        }
    }
}
