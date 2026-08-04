package org.example.controller;

import org.example.dto.ClickMarkerDto;
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


    @PostMapping("/{pecId}/sync-timestamps")
    public ResponseEntity<List<NoteEntity>> syncTimestamps(
            @PathVariable("pecId") String pecId,
            @RequestBody List<ClickMarkerDto> markers) {

        List<NoteEntity> savedNotes = excelParserService.syncRecceTimestamps(pecId, markers);
        return ResponseEntity.ok(savedNotes);

    }
}