import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { API_BASE_URL } from '../services/api.config';
import { NotebookComponent } from './notebook.component';
import { NotebookNote, NotebookSettings, defaultNotebook } from './notebook.model';
import { BookCover, CoverSide, coverError, coverText, defaultBookCover } from './book-cover.model';

@Component({
  selector: 'app-reccebook', standalone: true, imports: [CommonModule, FormsModule, NotebookComponent],
  templateUrl: './reccebook.component.html',
  styles: [`:host{display:block}.cover-settings{padding:12px;margin:12px 0;border:1px solid var(--border);border-radius:8px}.cover-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}label{display:flex;flex-direction:column;gap:4px;font-size:13px;text-transform:none;letter-spacing:normal}input,select,textarea{min-width:0;width:100%;min-height:44px;background:var(--surface-inset);border:1px solid #738198;border-radius:6px;color:var(--text);padding:8px}button{min-height:44px}fieldset{min-width:0}.cover-check{flex-direction:row;align-items:center}.cover-check input{width:20px}button:focus-visible{outline:3px solid #ff8da0;outline-offset:2px}.cover-error{color:#ffaaaa}`],
})
export class RecceBookComponent implements OnChanges, OnDestroy {
  @Input() pecId = '';
  @Input() personal = false;
  @Input() settings: NotebookSettings = defaultNotebook();
  @Input() notes: NotebookNote[] = [];
  @Input() locked = false;
  @Input() active = true;
  @ViewChild(NotebookComponent) preview?: NotebookComponent;
  cover = defaultBookCover(); draft = defaultBookCover();
  loaded = false; editable = false; editing = false; saving = false; error = '';
  side: 'front' | 'back' = 'front'; selected = 0;
  layoutError: string | null = null;
  private request?: Subscription;
  private publicationRequest?: Subscription;
  revision: number | null = null;
  publishing = false;
  publicationError = '';
  publicationStatus = '';
  private publicationReady = false;
  constructor(private http: HttpClient) {}
  ngOnChanges(changes: SimpleChanges) { if (changes['pecId'] || changes['personal']) this.load(); }
  get endpoint() { return this.personal ? `${API_BASE_URL}/api/reccebook-template` : `${API_BASE_URL}/api/pecs/${encodeURIComponent(this.pecId)}/reccebook-cover`; }
  private get publicationEndpoint() { return `${API_BASE_URL}/api/pecs/${encodeURIComponent(this.pecId)}/book-publication`; }
  get page(): CoverSide { return this.draft[this.side]; }
  get item() { return this.page.elements[this.selected]; }
  get schemaError() { return coverError(this.draft); }
  get hasUnsavedChanges() { return this.editing && JSON.stringify(this.draft) !== JSON.stringify(this.cover); }
  load() {
    this.request?.unsubscribe(); this.loaded = false; this.editable = false; this.editing = false; this.error = ''; this.saving = false;
    this.publicationRequest?.unsubscribe(); this.revision = null; this.publishing = false; this.publicationError = ''; this.publicationStatus = '';
    this.publicationReady = false;
    this.cover = defaultBookCover(); this.draft = defaultBookCover();
    if (!this.personal && !this.pecId) return;
    this.request = this.http.get<{ cover: BookCover; editable: boolean; publicationRevision?: number }>(this.endpoint).subscribe({
      next: value => {
        if (coverError(value.cover)) { this.error = 'A configuração da capa não é válida. Tenta carregar novamente.'; return; }
        this.cover = value.cover; this.draft = structuredClone(value.cover); this.editable = value.editable; this.loaded = true;
        if (!this.personal) this.revision = value.publicationRevision ?? null;
      },
      error: () => { this.error = 'Não foi possível carregar a capa. Tenta novamente antes de guardar ou exportar.'; },
    });
  }
  edit() { if (!this.loaded || !this.editable || this.locked) return; this.draft = structuredClone(this.cover); this.editing = true; this.error = ''; this.selected = 0; }
  cancel() { if (this.saving) return; this.draft = structuredClone(this.cover); this.editing = false; this.error = ''; }
  changed() { this.draft = structuredClone(this.draft); }
  changeSide() { this.selected = 0; }
  add() { if (this.page.elements.length >= 12) return; this.page.elements.push(coverText()); this.selected = this.page.elements.length - 1; this.changed(); }
  remove() { this.page.elements.splice(this.selected, 1); this.selected = Math.max(0, this.selected - 1); this.changed(); }
  save() {
    if (!this.loaded || !this.editing || !this.editable || this.locked || this.saving || this.schemaError || this.preview?.pending || this.preview?.coverLayoutError) return;
    this.saving = true; this.error = '';
    this.request = this.http.put<BookCover>(this.endpoint, this.draft).subscribe({
      next: value => { this.cover = value; this.draft = structuredClone(value); this.editing = false; this.saving = false; },
      error: () => { this.error = 'Não foi possível guardar a capa. As alterações mantêm-se; tenta novamente.'; this.saving = false; },
    });
  }
  previewValidated(error: string | null) {
    this.layoutError = error;
    this.publicationReady = !!this.preview && !this.preview.pending && !this.preview.error;
  }

  get canPublish() { return this.revision !== null && this.publicationReady && !this.publishing && !this.editing && this.active; }

  publish() {
    if (!this.canPublish) return;
    const snapshot = this.preview?.publication();
    if (!snapshot) return;
    this.publishing = true; this.publicationError = ''; this.publicationStatus = '';
    this.publicationRequest = this.http.put<{ revision: number }>(this.publicationEndpoint, snapshot).subscribe({
      next: value => { this.revision = value.revision; this.publishing = false; this.publicationStatus = `Versão ${value.revision} publicada.`; },
      error: () => { this.publishing = false; this.publicationError = 'Não foi possível publicar. A última versão publicada continua disponível.'; },
    });
  }
  ngOnDestroy() { this.request?.unsubscribe(); this.publicationRequest?.unsubscribe(); }
}
