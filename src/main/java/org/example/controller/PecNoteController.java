package org.example.controller;

import org.example.dto.ClickMarkerDto;
import org.example.dto.NoteOffsetDTO;
import org.example.entity.NoteEntity;
import org.example.service.NoteExcelParserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/pecs")
@CrossOrigin(origins = "http://localhost:4200")
public class PecNoteController {

    @Autowired
    private NoteExcelParserService excelParserService;

    // 1. DOWNLOAD TEMPLATE LIMPO
    @GetMapping("/download-template")
    public ResponseEntity<byte[]> downloadTemplate() {
        byte[] excelBytes = excelParserService.generateCleanExcelTemplate();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=Template_Notas_PEC.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelBytes);
    }

    @GetMapping("/{pecId}/download-template")
    public ResponseEntity<byte[]> downloadTemplateWithNotes(@PathVariable String pecId) {
        byte[] excelBytes = excelParserService.generateExcelTemplate(pecId);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=Template_Notas_PEC_" + pecId + ".xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelBytes);
    }

    // 2. UPLOAD EXCEL E GUARDAR NA BD
    @PostMapping("/{pecId}/import-excel")
    public ResponseEntity<List<NoteEntity>> importNotesFromExcel(
            @PathVariable String pecId,
            @RequestParam("file") MultipartFile file) {

        List<NoteEntity> savedNotes = excelParserService.parseAndSaveExcelNotes(pecId, file);
        return ResponseEntity.ok(savedNotes);
    }

    // 3. BUSCAR NOTAS DA BASE DE DADOS PARA A PÁGINA
    @GetMapping("/{pecId}/notes")
    public ResponseEntity<List<NoteEntity>> getNotesForPec(@PathVariable String pecId) {
        List<NoteEntity> notes = excelParserService.getNotesByPecId(pecId);
        return ResponseEntity.ok(notes);
    }

    @PostMapping("/{pecId}/notes")
    public ResponseEntity<NoteEntity> saveNote(@PathVariable String pecId, @RequestBody NoteEntity note) {
        return ResponseEntity.ok(excelParserService.saveNote(pecId, note));
    }

    @PatchMapping("/{pecId}/notes/{noteId}")
    public ResponseEntity<NoteEntity> updateNote(
            @PathVariable String pecId,
            @PathVariable Long noteId,
            @RequestBody NoteEntity note) {
        return ResponseEntity.ok(excelParserService.updateNote(pecId, noteId, note));
    }

    @DeleteMapping("/{pecId}/notes/{noteId}")
    public ResponseEntity<Void> deleteNote(@PathVariable String pecId, @PathVariable Long noteId) {
        excelParserService.deleteNote(pecId, noteId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{pecId}/notes/apply-offset")
    public ResponseEntity<List<NoteEntity>> applyOffset(
            @PathVariable String pecId,
            @RequestBody NoteOffsetDTO offsetDTO) {
        return ResponseEntity.ok(excelParserService.applyOffset(pecId, offsetDTO.getOffsetSeconds()));
    }


    @PostMapping("/{pecId}/sync-timestamps")
    public ResponseEntity<List<NoteEntity>> syncTimestamps(
            @PathVariable("pecId") String pecId,
            @RequestBody List<ClickMarkerDto> markers) {

        List<NoteEntity> savedNotes = excelParserService.syncRecceTimestamps(pecId, markers);
        return ResponseEntity.ok(savedNotes);

    }
}
