package org.example.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.example.dto.ClickMarkerDto;
import org.example.entity.NoteEntity;
import org.example.repository.NoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@Service
public class NoteExcelParserService {

    @Autowired
    private NoteRepository noteRepository;

    /**
     * 1. GERA TEMPLATE DE EXCEL LIMPO (Apenas cabeçalhos formatados)
     */
    public byte[] generateCleanExcelTemplate() {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Caderno de Notas");

            // Estilo do Cabeçalho
            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(font);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_RED.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Linha 0: Cabeçalho
            Row headerRow = sheet.createRow(0);
            String[] headers = {"Tempo (Segundos)", "Nota do Troço", "Observações / Mudança"};

            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 6000); // Ajusta largura das colunas
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar template limpo: " + e.getMessage());
        }
    }

    @Transactional
    public List<NoteEntity> parseAndSaveExcelNotes(String pecId, MultipartFile file) {
        List<NoteEntity> notesToSave = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);

            // Percorre todas as linhas (a partir da 1, ignorando o cabeçalho)
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                // 1. LER TEXTO DA NOTA (Coluna 1 - B)
                Cell textCell = row.getCell(1);
                String text = (textCell != null) ? formatter.formatCellValue(textCell).trim() : "";

                // Se a nota não tiver texto (linha totalmente em branco), ignora esta linha
                if (text.isEmpty()) {
                    continue;
                }

                // 2. LER TIMESTAMP (Coluna 0 - A)
                Cell timeCell = row.getCell(0);
                Double timestamp = 0.0; // Valor por defeito caso a Coluna A esteja vazia!

                if (timeCell != null) {
                    try {
                        if (timeCell.getCellType() == CellType.NUMERIC) {
                            timestamp = timeCell.getNumericCellValue();
                        } else {
                            String textVal = formatter.formatCellValue(timeCell).trim().replace(",", ".");
                            if (!textVal.isEmpty()) {
                                timestamp = Double.parseDouble(textVal);
                            }
                        }
                    } catch (Exception e) {
                        timestamp = 0.0; // Se falhar a conversão de texto para número, assume 0.0
                    }
                }

                // 3. LER OBSERVAÇÕES / VELOCIDADE (Coluna 2 - C)
                Cell speedCell = row.getCell(2);
                String speedRating = (speedCell != null) ? formatter.formatCellValue(speedCell).trim() : "";

                // 4. CRIAR A ENTIDADE
                NoteEntity note = NoteEntity.builder()
                        .pecId(pecId)
                        .originalTimestamp(timestamp)
                        .text(text)
                        .speedRating(speedRating)
                        .build();

                notesToSave.add(note);
            }

            // GUARDA NA BASE DE DADOS H2
            if (!notesToSave.isEmpty()) {
                // Limpa as notas anteriores da mesma PEC para não duplicar
                noteRepository.deleteByPecId(pecId);
                // Guarda as novas notas na BD e retorna a lista com os IDs criados
                return noteRepository.saveAll(notesToSave);
            }

            return new ArrayList<>();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao processar ficheiro Excel: " + e.getMessage());
        }
    }

    /**
     * 3. BUSCA AS NOTAS DA BASE DE DADOS PARA A PÁGINA
     */
    public List<NoteEntity> getNotesByPecId(String pecId) {
        return noteRepository.findByPecIdOrderByOriginalTimestampAsc(pecId);
    }

    /**
     * Sincroniza os timestamps recolhidos no modo Recce (telemóvel) com a BD.
     */
    @Transactional
    public List<NoteEntity> syncRecceTimestamps(String pecId, List<ClickMarkerDto> markers) {
        if (markers == null || markers.isEmpty()) {
            return noteRepository.findByPecIdOrderByOriginalTimestampAsc(pecId);
        }

        List<NoteEntity> notesToSave = new ArrayList<>();

        for (ClickMarkerDto marker : markers) {
            NoteEntity note = NoteEntity.builder()
                    .pecId(pecId)
                    .originalTimestamp(marker.getTimestamp())
                    .text("") // Fica vazio para o copiloto preencher na app ou no Excel
                    .speedRating("")
                    .build();
            notesToSave.add(note);
        }

        // Apaga as notas antigas desta PEC e guarda a nova lista sincronizada
        noteRepository.deleteByPecId(pecId);
        return noteRepository.saveAll(notesToSave);
    }

    // ... restantes métodos (parseAndSaveExcelNotes, generateCleanExcelTemplate, etc.)
}