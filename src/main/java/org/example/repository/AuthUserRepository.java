package org.example.repository;

import org.example.entity.AuthUserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface AuthUserRepository extends JpaRepository<AuthUserEntity, String> {
    Optional<AuthUserEntity> findByEmailIgnoreCase(String email);
    Optional<AuthUserEntity> findByTokenAndActiveTrue(String token);
    boolean existsByEmailIgnoreCase(String email);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update AuthUserEntity user set user.tokenExpiresAtEpochMillis = null where user.token = :token")
    int revokeToken(@Param("token") String token);
}
