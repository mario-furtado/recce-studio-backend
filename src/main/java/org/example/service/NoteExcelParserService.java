package org.example.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.example.dto.ClickMarkerDto;
import org.example.entity.NoteEntity;
import org.example.entity.PecEntity;
import org.example.entity.RallyEntity;
import org.example.repository.NoteRepository;
import org.example.repository.PecRepository;
import org.example.repository.TeamCarRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@Service
public class NoteExcelParserService {

    private final NoteRepository noteRepository;
    private final PecRepository pecRepository;
    private final TeamCarRepository teamCarRepository;

    public NoteExcelParserService(NoteRepository noteRepository, PecRepository pecRepository, TeamCarRepository teamCarRepository) {
        this.noteRepository = noteRepository;
        this.pecRepository = pecRepository;
        this.teamCarRepository = teamCarRepository;
    }

    public byte[] generateCleanExcelTemplate() {
        return generateExcelTemplate(new ArrayList<>());
    }

    public byte[] generateExcelTemplate(String pecId) {
        return generateExcelTemplate(pecId, getNotesByPecId(pecId));
    }

    public byte[] generateExcelTemplate(String pecId, List<NoteEntity> notes) {
        PecEntity pec = pecRepository.findById(pecId)
                .orElseThrow(() -> new RuntimeException("PEC nao encontrada com ID: " + pecId));
        return generateExcelTemplate(notes, pec);
    }

    public byte[] generateExcelTemplate(List<NoteEntity> notes) {
        return generateExcelTemplate(notes, null);
    }

    public byte[] generateExcelTemplate(List<NoteEntity> notes, PecEntity pec) {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Caderno de Notas");

            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(font);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_RED.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            int headerRowIndex = 0;
            if (pec != null) {
                headerRowIndex = writePecInfo(sheet, pec) + 2;
            }

            Row headerRow = sheet.createRow(headerRowIndex);
            String[] headers = {"Tempo (Segundos)", "Nota do Troco", "Observacoes / Mudanca"};

            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 6000);
            }

            for (int i = 0; i < notes.size(); i++) {
                NoteEntity note = notes.get(i);
                Row row = sheet.createRow(headerRowIndex + i + 1);
                if (note.getOriginalTimestamp() != null) {
                    row.createCell(0).setCellValue(note.getOriginalTimestamp());
                }
                row.createCell(1).setCellValue(note.getText() != null ? note.getText() : "");
                row.createCell(2).setCellValue(note.getSpeedRating() != null ? note.getSpeedRating() : "");
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar template: " + e.getMessage());
        }
    }

    private int writePecInfo(Sheet sheet, PecEntity pec) {
        RallyEntity rally = pec.getRally();
        String carName = "";
        String carClass = rally != null ? rally.getCarClass() : "";
        if (rally != null && rally.getCarId() != null) {
            carName = teamCarRepository.findById(rally.getCarId())
                    .map(car -> car.getName())
                    .orElse("");
        }

        String[][] rows = {
                {"Informacoes da PEC", ""},
                {"Rali", rally != null ? rally.getName() + " " + rally.getYear() : ""},
                {"PEC", pec.getName()},
                {"Distancia (km)", String.valueOf(pec.getDistanceKm())},
                {"Numero de notas", String.valueOf(noteRepository.countByPecId(pec.getId()))},
                {"Carro", carName},
                {"Classe", carClass != null ? carClass : ""}
        };

        for (int i = 0; i < rows.length; i++) {
            Row row = sheet.createRow(i);
            row.createCell(0).setCellValue(rows[i][0]);
            row.createCell(1).setCellValue(rows[i][1]);
        }
        return rows.length - 1;
    }

    @Transactional
    public List<NoteEntity> parseAndSaveExcelNotes(String pecId, MultipartFile file) {
        ensurePecCanBeEdited(pecId);
        List<NoteEntity> notesToSave = new ArrayList<>();
        List<NoteEntity> existingTimestamps = noteRepository.findByPecIdOrderByOriginalTimestampAsc(pecId);
        DataFormatter formatter = new DataFormatter();

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) {
                    continue;
                }

                String text = cellText(row.getCell(1), formatter);
                if (text.isEmpty()) {
                    continue;
                }

                Double timestamp = parseTimestamp(row.getCell(0), formatter);
                if (timestamp == null) {
                    int noteIndex = notesToSave.size();
                    timestamp = noteIndex < existingTimestamps.size()
                            ? existingTimestamps.get(noteIndex).getOriginalTimestamp()
                            : 0.0;
                }

                String speedRating = cellText(row.getCell(2), formatter);

                notesToSave.add(NoteEntity.builder()
                        .pecId(pecId)
                        .originalTimestamp(timestamp)
                        .text(text)
                        .speedRating(speedRating)
                        .build());
            }

            noteRepository.deleteByPecId(pecId);
            return noteRepository.saveAll(notesToSave);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao processar ficheiro Excel: " + e.getMessage());
        }
    }

    public List<NoteEntity> getNotesByPecId(String pecId) {
        return noteRepository.findByPecIdOrderByOriginalTimestampAsc(pecId);
    }

    public NoteEntity saveNote(String pecId, NoteEntity note) {
        ensurePecCanBeEdited(pecId);
        note.setPecId(pecId);
        return noteRepository.save(note);
    }

    public NoteEntity updateNote(String pecId, Long noteId, NoteEntity note) {
        ensurePecCanBeEdited(pecId);
        NoteEntity existing = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Nota nao encontrada com ID: " + noteId));
        if (!pecId.equals(existing.getPecId())) {
            throw new RuntimeException("Nota nao pertence a esta PEC");
        }
        existing.setText(note.getText());
        existing.setSpeedRating(note.getSpeedRating());
        if (note.getOriginalTimestamp() != null) {
            existing.setOriginalTimestamp(note.getOriginalTimestamp());
        }
        return noteRepository.save(existing);
    }

    public void deleteNote(String pecId, Long noteId) {
        ensurePecCanBeEdited(pecId);
        noteRepository.deleteById(noteId);
    }

    @Transactional
    public List<NoteEntity> applyOffset(String pecId, Double offsetSeconds) {
        ensurePecCanBeEdited(pecId);
        if (offsetSeconds == null) {
            offsetSeconds = 0.0;
        }

        List<NoteEntity> notes = noteRepository.findByPecIdOrderByOriginalTimestampAsc(pecId);
        for (NoteEntity note : notes) {
            double currentTimestamp = note.getOriginalTimestamp() != null ? note.getOriginalTimestamp() : 0.0;
            double adjustedTimestamp = Math.max(0.0, currentTimestamp + offsetSeconds);
            note.setOriginalTimestamp(Math.round(adjustedTimestamp * 10.0) / 10.0);
        }

        return noteRepository.saveAll(notes);
    }

    @Transactional
    public List<NoteEntity> syncRecceTimestamps(String pecId, List<ClickMarkerDto> markers) {
        ensurePecCanBeEdited(pecId);
        if (markers == null || markers.isEmpty()) {
            return noteRepository.findByPecIdOrderByOriginalTimestampAsc(pecId);
        }

        List<NoteEntity> notesToSave = new ArrayList<>();
        for (ClickMarkerDto marker : markers) {
            notesToSave.add(NoteEntity.builder()
                    .pecId(pecId)
                    .originalTimestamp(marker.getTimestamp())
                    .text("")
                    .speedRating("")
                    .build());
        }

        noteRepository.deleteByPecId(pecId);
        return noteRepository.saveAll(notesToSave);
    }

    private String cellText(Cell cell, DataFormatter formatter) {
        return cell != null ? formatter.formatCellValue(cell).trim() : "";
    }

    private Double parseTimestamp(Cell cell, DataFormatter formatter) {
        if (cell == null) {
            return null;
        }
        try {
            if (cell.getCellType() == CellType.NUMERIC) {
                return cell.getNumericCellValue();
            }
            String value = formatter.formatCellValue(cell).trim().replace(",", ".");
            return value.isEmpty() ? null : Double.parseDouble(value);
        } catch (Exception e) {
            return null;
        }
    }

    private void ensurePecCanBeEdited(String pecId) {
        boolean completed = pecRepository.findById(pecId)
                .map(pec -> "COMPLETED".equalsIgnoreCase(pec.getStatus())
                        || (pec.getRally() != null && "COMPLETED".equalsIgnoreCase(pec.getRally().getStatus())))
                .orElseThrow(() -> new RuntimeException("PEC nao encontrada com ID: " + pecId));
        if (completed) {
            throw new IllegalStateException("PEC ou rali concluido. Volte a colocar em rascunho para alterar.");
        }
    }
}
