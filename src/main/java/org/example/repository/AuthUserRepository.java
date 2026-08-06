package org.example.repository;

import org.example.entity.AuthUserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuthUserRepository extends JpaRepository<AuthUserEntity, String> {
    Optional<AuthUserEntity> findByEmailIgnoreCase(String email);
    Optional<AuthUserEntity> findByTokenAndActiveTrue(String token);
    boolean existsByEmailIgnoreCase(String email);
}
