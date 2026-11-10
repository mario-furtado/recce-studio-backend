package org.example.repository;

import org.example.entity.BookPublicationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookPublicationRepository extends JpaRepository<BookPublicationEntity, String> {}
