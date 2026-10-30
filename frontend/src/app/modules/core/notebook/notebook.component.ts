import { CommonModule } from '@angular/common';
import { AfterViewChecked, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { blockStyles, NoteBlockComponent } from './note-display.component';
import { composeNote, defaultNotebook, NoteBlock, NotebookNote, NotebookSettings, pageDimensions, settingsError } from './notebook.model';
import { composePresentedNote, presentationError } from './note-presentation';

import { BookCover, coverError, defaultBookCover } from './book-cover.model';
import { BookCoverPageComponent, coverPageStyles } from './book-cover-page.component';

interface NotebookRow { blocks: NoteBlock[]; number: number }
export const notebookStyles = `
.notebook-page{background:white;color:black;box-sizing:border-box;break-after:page;page-break-after:always;font-family:Arial,sans-serif;overflow:visible;flex-shrink:0}
.notebook-page:last-child{break-after:auto;page-break-after:auto}
.notebook-row{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;padding:2px 0;white-space:pre;position:relative}
.notebook-row.ruled{border-bottom:1px solid black}
app-note-block{display:contents}
${blockStyles}
`;

@Component({
  selector: 'app-notebook', standalone: true, imports: [CommonModule, NoteBlockComponent, BookCoverPageComponent],
  template: `
    <div class="notebook-controls">
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="!notes.length">Sem notas. O ficheiro inclui a capa e a contracapa.</p>
      <p>Pré-visualização à escala real. As sequências longas continuam nas linhas seguintes.</p>
      <button type="button" class="soft-button px-3 py-2 rounded" (click)="print()" [disabled]="!!error || pending || exportBlocked">Imprimir / Guardar PDF</button>
      <p *ngIf="printError" role="alert">{{ printError }}</p>
    </div>
    <div class="notebook-scroll" tabindex="0" role="region" aria-label="Pré-visualização do caderno; usa as setas para deslocar">
      <div #measure class="notebook-measure" [style.fontSize.pt]="settings.page.fontPt" aria-hidden="true">
        <app-note-block *ngFor="let item of measured" [block]="item.block" />
      </div>
      <div #pagesElement class="notebook-pages">
        <app-book-cover-page [side]="cover.front" [dimensions]="dimensions" />
        <section *ngFor="let page of pages; let pageIndex = index" class="notebook-page book-sheet" [attr.aria-label]="'Página ' + (pageIndex + 2)"
          [style.width.mm]="dimensions[0]" [style.height.mm]="dimensions[1]" [style.padding.mm]="settings.page.marginMm" [style.fontSize.pt]="settings.page.fontPt">
          <div *ngFor="let row of page" class="notebook-row" [class.ruled]="settings.page.separators" [style.height.mm]="rowHeight"
            [style.justifyContent]="settings.page.alignment === 'left' ? 'flex-start' : settings.page.alignment === 'right' ? 'flex-end' : 'center'">
            <app-note-block *ngFor="let block of row.blocks" [block]="block" />
          </div>
        </section>
        <app-book-cover-page [side]="cover.back" [dimensions]="dimensions" [back]="true" />
      </div>
    </div>`,
  styles: [notebookStyles, `.notebook-scroll{overflow:auto;max-height:75vh;position:relative;background:#666;padding:12px}.notebook-page{margin:0 auto 12px}.notebook-measure{position:absolute;visibility:hidden;pointer-events:none;display:flex;gap:0;width:max-content;font-family:Arial,sans-serif}.notebook-controls{padding:12px}.notebook-controls [role=alert]{color:#f97373}`],
})
export class NotebookComponent implements OnChanges, AfterViewChecked, OnDestroy {
  @Input() cover: BookCover = defaultBookCover();
  @Input() exportBlocked = false;
  @Input() active = true;
  @Output() coverValidated = new EventEmitter<string | null>(true);
  coverLayoutError: string | null = null;
  @Input() notes: NotebookNote[] = [];
  @Input() settings: NotebookSettings = defaultNotebook();
  @ViewChild('measure') measure?: ElementRef<HTMLElement>;
  @ViewChild('pagesElement') pagesElement?: ElementRef<HTMLElement>;
  measured: { block: NoteBlock; number: number; newRow: boolean }[] = [];
  pages: NotebookRow[][] = [];
  dimensions: [number, number] = [210, 297];
  rowHeight = 0;
  error: string | null = null;
  printError = '';
  pending = true;
  private frame?: HTMLIFrameElement;
  constructor(private change: ChangeDetectorRef) {}

  ngOnChanges() {
    this.coverLayoutError = coverError(this.cover);
    this.error = settingsError(this.settings) || this.coverLayoutError;
    this.dimensions = pageDimensions(this.settings);
    this.rowHeight = (this.dimensions[1] - 2 * this.settings.page.marginMm) / this.settings.page.rowsPerPage;
    this.measured = this.notes.flatMap((note, index) => {
      this.error ||= presentationError(note.text, note.presentationJson);
      const blocks = composePresentedNote(note.text, this.settings.rules, note.presentationJson);
      if (note.speedRating?.trim()) blocks.push(...composeNote('\n' + note.speedRating, []));
      return blocks.map((block, at) => ({ block, number: index + 1, newRow: at === 0 || !!block.breakBefore }));
    });
    this.pages = []; this.pending = true;
  }

  ngAfterViewChecked() {
    if (!this.active || !this.pending || !this.measure) return;
    this.pending = false;
    if (!this.error) this.paginate();
    if (!this.coverLayoutError) this.checkCoverLayout();
    this.coverValidated.emit(this.coverLayoutError);
    this.change.detectChanges();
  }

  private paginate() {
    const pxPerMm = 96 / 25.4;
    const maxWidth = (this.dimensions[0] - 2 * this.settings.page.marginMm) * pxPerMm;
    const maxHeight = this.rowHeight * pxPerMm - 5; // row padding and separator
    const elements = Array.from(this.measure!.nativeElement.querySelectorAll<HTMLElement>('.note-block'));
    const rows: NotebookRow[] = [];
    let width = 0;
    for (let index = 0; index < this.measured.length; index++) {
      const item = this.measured[index];
      const rect = elements[index]?.getBoundingClientRect();
      if (!rect || rect.width > maxWidth + .1 || rect.height > maxHeight + .1) {
        this.error = `A nota ${item.number} não cabe. Reduz as linhas por página, ajusta a letra/margens ou divide o bloco no texto original. Nenhum conteúdo foi cortado.`;
        return;
      }
      if (!rows.length || item.newRow || width + 8 + rect.width > maxWidth) {
        rows.push({ blocks: [], number: item.number }); width = 0;
      }
      rows[rows.length - 1].blocks.push(item.block);
      width += (width ? 8 : 0) + rect.width;
    }
    for (let at = 0; at < rows.length; at += this.settings.page.rowsPerPage) this.pages.push(rows.slice(at, at + this.settings.page.rowsPerPage));
    if (this.pages.length) {
      const last = this.pages[this.pages.length - 1];
      while (last.length < this.settings.page.rowsPerPage) last.push({ blocks: [], number: 0 });
    }
  }

  private checkCoverLayout() {
    for (const page of Array.from(this.pagesElement?.nativeElement.querySelectorAll<HTMLElement>('.cover-editable') ?? [])) {
      const area = page.getBoundingClientRect();
      const items = Array.from(page.querySelectorAll<HTMLElement>('.cover-item')).filter(item => item.textContent?.trim());
      const rects = items.map(item => item.getBoundingClientRect());
      for (let index = 0; index < rects.length; index++) {
        const r = rects[index];
        const outside = r.left < area.left - .5 || r.top < area.top - .5 || r.right > area.right + .5 || r.bottom > area.bottom + .5;
        const overlap = rects.slice(0, index).some(other => r.left < other.right - .5 && r.right > other.left + .5 && r.top < other.bottom - .5 && r.bottom > other.top + .5);
        if (outside || overlap) { this.coverLayoutError = 'O texto da capa ou contracapa não cabe ou sobrepõe outro elemento. Ajusta posição, largura ou tamanho antes de exportar.'; this.error ||= this.coverLayoutError; return; }
      }
    }
  }

  async print() {
    if (!this.active || this.error || this.pending || this.exportBlocked || !this.pagesElement) return;
    this.frame?.remove();
    this.printError = '';
    const frame = document.createElement('iframe');
    frame.title = 'Caderno para impressão';
    frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0';
    document.body.appendChild(frame); this.frame = frame;
    const doc = frame.contentDocument!;
    doc.title = 'Recce Studio — Caderno';
    const style = doc.createElement('style');
    style.textContent = `@page{size:${this.dimensions[0]}mm ${this.dimensions[1]}mm;margin:0}html,body{padding:0;margin:0}${notebookStyles}${coverPageStyles}`;
    doc.head.appendChild(style);
    const pages = this.pagesElement.nativeElement.cloneNode(true) as HTMLElement;
    doc.body.appendChild(pages);
    try {
      await doc.fonts.ready;
      await Promise.all(Array.from(doc.images).map(img => img.decode()));
      if (this.frame !== frame) return;
      frame.contentWindow!.focus(); frame.contentWindow!.print();
    } catch { if (this.frame === frame) this.printError = 'Não foi possível preparar a impressão ou o logótipo. Verifica a ligação/permissões e tenta novamente.'; }
  }

  ngOnDestroy() { this.frame?.remove(); }
}
