package org.example.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.example.dto.ClickMarkerDto;
import org.example.dto.NoteAlignmentDTO;
import org.example.entity.NoteEntity;
import org.example.entity.PecEntity;
import org.example.entity.RallyEntity;
import org.example.repository.NoteRepository;
import org.example.repository.PecRepository;
import org.example.repository.TeamCarRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.apache.poi.ss.util.CellRangeAddress;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.LocalDate;
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
            sheet.setDisplayGridlines(false);

            CellStyle tableHeaderStyle = tableHeaderStyle(workbook);
            CellStyle timestampStyle = editableDataStyle(workbook, "0.0");
            CellStyle noteStyle = editableDataStyle(workbook, null);
            CellStyle observationStyle = editableDataStyle(workbook, null);

            int headerRowIndex = 0;
            if (pec != null) {
                headerRowIndex = writePecInfo(workbook, sheet, pec) + 2;
            } else {
                headerRowIndex = writeCleanTemplateInfo(workbook, sheet) + 2;
            }

            Row headerRow = sheet.createRow(headerRowIndex);
            headerRow.setHeightInPoints(24);
            String[] headers = {"Tempo (Segundos)", "Nota do Troco", "Observacoes / Mudanca"};

            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(tableHeaderStyle);
            }

            int editableRows = Math.max(notes.size(), 20);
            for (int i = 0; i < editableRows; i++) {
                NoteEntity note = i < notes.size() ? notes.get(i) : null;
                Row row = sheet.createRow(headerRowIndex + i + 1);

                Cell timestampCell = row.createCell(0);
                timestampCell.setCellStyle(timestampStyle);
                if (note != null && note.getOriginalTimestamp() != null) {
                    timestampCell.setCellValue(note.getOriginalTimestamp());
                }

                Cell noteCell = row.createCell(1);
                noteCell.setCellStyle(noteStyle);
                noteCell.setCellValue(note != null && note.getText() != null ? note.getText() : "");

                Cell observationCell = row.createCell(2);
                observationCell.setCellStyle(observationStyle);
                observationCell.setCellValue(note != null && note.getSpeedRating() != null ? note.getSpeedRating() : "");
            }

            int lastTableRow = headerRowIndex + editableRows;
            sheet.setAutoFilter(new CellRangeAddress(headerRowIndex, lastTableRow, 0, 2));
            sheet.createFreezePane(0, headerRowIndex + 1);
            sheet.setColumnWidth(0, 5200);
            sheet.setColumnWidth(1, 11200);
            sheet.setColumnWidth(2, 11200);
            sheet.protectSheet("recce-studio");

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar template: " + e.getMessage());
        }
    }

    private int writePecInfo(Workbook workbook, Sheet sheet, PecEntity pec) {
        RallyEntity rally = pec.getRally();
        String carName = "";
        String carClass = rally != null ? rally.getCarClass() : "";
        if (rally != null && rally.getCarId() != null) {
            carName = teamCarRepository.findById(rally.getCarId())
                    .map(car -> car.getName())
                    .orElse("");
        }

        CellStyle titleStyle = titleStyle(workbook);
        CellStyle subtitleStyle = subtitleStyle(workbook);
        CellStyle labelStyle = metadataLabelStyle(workbook);
        CellStyle valueStyle = metadataValueStyle(workbook);
        CellStyle mutedValueStyle = metadataMutedValueStyle(workbook);

        mergeAndSet(sheet, 0, 0, 0, 2, "RECCE STUDIO - CADERNO DE NOTAS", titleStyle);
        mergeAndSet(sheet, 1, 1, 0, 2, "Campos oficiais da PEC bloqueados para edicao. Edite apenas a tabela de notas.", subtitleStyle);

        writeMetadataBlock(sheet, 3, 0, "RALI", rally != null ? rally.getName() + " " + rally.getYear() : "", labelStyle, valueStyle);
        writeMetadataBlock(sheet, 3, 1, "PEC", "PEC " + pec.getNumber() + " - " + pec.getName(), labelStyle, valueStyle);
        writeMetadataBlock(sheet, 3, 2, "DATA", pec.getUpdatedAt() != null ? pec.getUpdatedAt().toString() : LocalDate.now().toString(), labelStyle, valueStyle);

        writeMetadataBlock(sheet, 6, 0, "DISTANCIA", String.format("%.1f km", pec.getDistanceKm()), labelStyle, valueStyle);
        writeMetadataBlock(sheet, 6, 1, "N. NOTAS", String.valueOf(noteRepository.countByPecId(pec.getId())), labelStyle, valueStyle);
        writeMetadataBlock(sheet, 6, 2, "PISO", rally != null && rally.getSurface() != null ? rally.getSurface() : "", labelStyle, valueStyle);

        writeMetadataBlock(sheet, 9, 0, "CARRO", hasText(carName) ? carName : "Nao associado", labelStyle, mutedValueStyle);
        writeMetadataBlock(sheet, 9, 1, "CLASSE", hasText(carClass) ? carClass : "Nao associada", labelStyle, mutedValueStyle);
        writeMetadataBlock(sheet, 9, 2, "LOCALIZACAO", rally != null ? rally.getLocation() : "", labelStyle, mutedValueStyle);

        return 11;
    }

    private int writeCleanTemplateInfo(Workbook workbook, Sheet sheet) {
        CellStyle titleStyle = titleStyle(workbook);
        CellStyle subtitleStyle = subtitleStyle(workbook);

        mergeAndSet(sheet, 0, 0, 0, 2, "RECCE STUDIO - TEMPLATE DE NOTAS", titleStyle);
        mergeAndSet(sheet, 1, 1, 0, 2, "Preencha apenas a tabela de notas. Os campos oficiais aparecem quando o template pertence a uma PEC.", subtitleStyle);
        return 3;
    }

    private void writeMetadataBlock(Sheet sheet, int rowIndex, int columnIndex, String label, String value, CellStyle labelStyle, CellStyle valueStyle) {
        Row labelRow = getOrCreateRow(sheet, rowIndex);
        Row valueRow = getOrCreateRow(sheet, rowIndex + 1);
        labelRow.setHeightInPoints(18);
        valueRow.setHeightInPoints(30);

        Cell labelCell = labelRow.createCell(columnIndex);
        labelCell.setCellValue(label);
        labelCell.setCellStyle(labelStyle);

        Cell valueCell = valueRow.createCell(columnIndex);
        valueCell.setCellValue(value != null ? value : "");
        valueCell.setCellStyle(valueStyle);
    }

    private Row getOrCreateRow(Sheet sheet, int rowIndex) {
        Row row = sheet.getRow(rowIndex);
        return row != null ? row : sheet.createRow(rowIndex);
    }

    private void mergeAndSet(Sheet sheet, int firstRow, int lastRow, int firstCol, int lastCol, String value, CellStyle style) {
        sheet.addMergedRegion(new CellRangeAddress(firstRow, lastRow, firstCol, lastCol));
        Row row = getOrCreateRow(sheet, firstRow);
        Cell cell = row.createCell(firstCol);
        cell.setCellValue(value);
        cell.setCellStyle(style);
        for (int col = firstCol + 1; col <= lastCol; col++) {
            Cell mergedCell = row.createCell(col);
            mergedCell.setCellStyle(style);
        }
    }

    private CellStyle titleStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 15);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setLocked(true);
        addMediumBottomBorder(style, IndexedColors.RED.getIndex());
        return style;
    }

    private CellStyle subtitleStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setItalic(true);
        font.setFontHeightInPoints((short) 10);
        font.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setLocked(true);
        addThinBorder(style, IndexedColors.GREY_40_PERCENT.getIndex());
        return style;
    }

    private CellStyle metadataLabelStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 9);
        font.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setLocked(true);
        addThinBorder(style, IndexedColors.GREY_40_PERCENT.getIndex());
        return style;
    }

    private CellStyle metadataValueStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 11);
        font.setColor(IndexedColors.BLACK.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.WHITE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        style.setLocked(true);
        addThinBorder(style, IndexedColors.GREY_40_PERCENT.getIndex());
        return style;
    }

    private CellStyle metadataMutedValueStyle(Workbook workbook) {
        CellStyle style = metadataValueStyle(workbook);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 10);
        font.setColor(IndexedColors.GREY_80_PERCENT.getIndex());
        style.setFont(font);
        return style;
    }

    private CellStyle tableHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 10);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_RED.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setLocked(true);
        addThinBorder(style, IndexedColors.GREY_40_PERCENT.getIndex());
        return style;
    }

    private CellStyle editableDataStyle(Workbook workbook, String dataFormat) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setFontHeightInPoints((short) 10);
        font.setColor(IndexedColors.BLACK.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.LEMON_CHIFFON.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.TOP);
        style.setWrapText(true);
        style.setLocked(false);
        if (dataFormat != null) {
            style.setDataFormat(workbook.createDataFormat().getFormat(dataFormat));
        }
        addThinBorder(style, IndexedColors.GREY_25_PERCENT.getIndex());
        return style;
    }

    private void addThinBorder(CellStyle style, short color) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setTopBorderColor(color);
        style.setRightBorderColor(color);
        style.setBottomBorderColor(color);
        style.setLeftBorderColor(color);
    }

    private void addMediumBottomBorder(CellStyle style, short color) {
        style.setBorderBottom(BorderStyle.MEDIUM);
        style.setBottomBorderColor(color);
    }

    @Transactional
    public List<NoteEntity> parseAndSaveExcelNotes(String pecId, MultipartFile file) {
        ensurePecCanBeEdited(pecId);
        List<NoteEntity> notesToSave = new ArrayList<>();
        List<NoteEntity> existingTimestamps = noteRepository.findByPecIdOrderByIdAsc(pecId);
        DataFormatter formatter = new DataFormatter();

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int tableHeaderRow = findNotesHeaderRow(sheet, formatter);
            int firstNotesRow = tableHeaderRow >= 0 ? tableHeaderRow + 1 : 1;

            for (int i = firstNotesRow; i <= sheet.getLastRowNum(); i++) {
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
                            : null;
                }

                String speedRating = cellText(row.getCell(2), formatter);

                notesToSave.add(NoteEntity.builder()
                        .pecId(pecId)
                        .originalTimestamp(timestamp)
                        .text(text)
                        .speedRating(speedRating)
                        .build());
            }

            if (looksLikeUntimedImport(notesToSave)) {
                for (NoteEntity note : notesToSave) {
                    note.setOriginalTimestamp(null);
                }
            }

            noteRepository.deleteByPecId(pecId);
            return noteRepository.saveAll(notesToSave);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao processar ficheiro Excel: " + e.getMessage());
        }
    }

    public List<NoteEntity> getNotesByPecId(String pecId) {
        return noteRepository.findByPecIdOrderByIdAsc(pecId);
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
        existing.setOriginalTimestamp(note.getOriginalTimestamp());
        return noteRepository.save(existing);
    }

    @Transactional
    public List<NoteEntity> alignNote(String pecId, Long noteId, NoteAlignmentDTO alignment) {
        ensurePecCanBeEdited(pecId);
        NoteEntity target = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Nota nao encontrada com ID: " + noteId));
        if (!pecId.equals(target.getPecId())) {
            throw new RuntimeException("Nota nao pertence a esta PEC");
        }

        double oldTimestamp = timestampOrZero(target.getOriginalTimestamp());
        Double targetTimestamp = alignment != null ? alignment.getTargetTimestamp() : null;
        Double normalizedTimestamp = targetTimestamp != null
                ? roundTimestamp(Math.max(0.0, targetTimestamp))
                : null;
        double delta = normalizedTimestamp != null ? normalizedTimestamp - oldTimestamp : 0.0;
        boolean shiftFollowing = alignment != null && Boolean.TRUE.equals(alignment.getShiftFollowing());

        List<NoteEntity> notes = noteRepository.findByPecIdOrderByIdAsc(pecId);
        boolean afterTarget = false;
        for (NoteEntity note : notes) {
            if (note.getId().equals(noteId)) {
                if (alignment != null) {
                    note.setText(alignment.getText());
                    note.setSpeedRating(alignment.getSpeedRating());
                }
                note.setOriginalTimestamp(normalizedTimestamp);
                afterTarget = true;
                continue;
            }

            if (afterTarget && shiftFollowing && normalizedTimestamp != null && hasUsableTimestamp(note.getOriginalTimestamp())) {
                double shiftedTimestamp = Math.max(0.0, note.getOriginalTimestamp() + delta);
                note.setOriginalTimestamp(roundTimestamp(shiftedTimestamp));
            }
        }

        return noteRepository.saveAll(notes);
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
        for (int index = 0; index < markers.size(); index++) {
            ClickMarkerDto marker = markers.get(index);
            String noteText = hasText(marker.getText())
                    ? marker.getText().trim()
                    : "Nota Marcada " + (index + 1);
            String observation = hasText(marker.getSpeedRating())
                    ? marker.getSpeedRating().trim()
                    : (hasText(marker.getRawText()) ? marker.getRawText().trim() : "");

            notesToSave.add(NoteEntity.builder()
                    .pecId(pecId)
                    .originalTimestamp(marker.getTimestamp())
                    .text(noteText)
                    .speedRating(observation)
                    .build());
        }

        noteRepository.deleteByPecId(pecId);
        return noteRepository.saveAll(notesToSave);
    }

    private String cellText(Cell cell, DataFormatter formatter) {
        return cell != null ? formatter.formatCellValue(cell).trim() : "";
    }

    private int findNotesHeaderRow(Sheet sheet, DataFormatter formatter) {
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) {
                continue;
            }

            String firstCell = cellText(row.getCell(0), formatter).toLowerCase();
            String secondCell = cellText(row.getCell(1), formatter).toLowerCase();

            if (firstCell.contains("tempo") && secondCell.contains("nota")) {
                return i;
            }
        }
        return -1;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private boolean hasUsableTimestamp(Double timestamp) {
        return timestamp != null && timestamp > 0.0;
    }

    private boolean looksLikeUntimedImport(List<NoteEntity> notes) {
        if (notes == null || notes.size() <= 1) {
            return false;
        }
        for (NoteEntity note : notes) {
            if (note.getOriginalTimestamp() == null || Math.abs(note.getOriginalTimestamp()) > 0.0001) {
                return false;
            }
        }
        return true;
    }

    private double timestampOrZero(Double timestamp) {
        return timestamp != null ? timestamp : 0.0;
    }

    private double roundTimestamp(double timestamp) {
        return Math.round(timestamp * 10.0) / 10.0;
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
