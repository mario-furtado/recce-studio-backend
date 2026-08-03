package org.example.repository;

import org.example.entity.NoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<NoteEntity, Long> {

    // Procura todas as notas de uma determinada PEC, ordenadas por tempo cronológico
    List<NoteEntity> findByPecIdOrderByOriginalTimestampAsc(String pecId);

    // Apaga as notas anteriores se o utilizador voltar a carregar um Excel novo para a mesma PEC
    void deleteByPecId(String pecId);
}