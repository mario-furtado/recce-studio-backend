package org.example.repository;

import org.example.entity.NotebookPreferencesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotebookPreferencesRepository extends JpaRepository<NotebookPreferencesEntity, String> {}
