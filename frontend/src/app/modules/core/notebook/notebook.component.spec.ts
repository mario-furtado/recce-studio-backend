import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { defaultNotebook } from './notebook.model';
import { NotebookComponent } from './notebook.component';
import { NotebookSettingsComponent } from './notebook-settings.component';
import { NotebookService } from './notebook.service';
import { API_BASE_URL } from '../services/api.config';
import { NoteDisplayComponent } from './note-display.component';

describe('FEAT-004 measured notebook', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [NotebookComponent] }));
  it('FEAT-009 centers legacy rows between the margins by default', () => {
    const fixture = TestBed.createComponent(NotebookComponent);
    const legacy = defaultNotebook(); delete legacy.page.alignment;
    fixture.componentRef.setInput('settings', legacy);
    fixture.componentRef.setInput('notes', [{ text: 'E6++ nt' }, { text: 'D6 > E3 60 ATT E1 NC' }]);
    fixture.detectChanges();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.notebook-pages .notebook-row'));
    for (const row of rows.filter(row => row.querySelector('.note-block'))) {
      const blocks = Array.from(row.querySelectorAll<HTMLElement>('.note-block'));
      const rect = row.getBoundingClientRect();
      const left = blocks[0].getBoundingClientRect().left, right = blocks.at(-1)!.getBoundingClientRect().right;
      expect(Math.abs((left + right) / 2 - (rect.left + rect.right) / 2)).toBeLessThan(1);
    }
    fixture.destroy();
  });
  it('FEAT-009 aligns wrapped lines and the print copy without losing warnings or separators', async () => {
    const fixture = TestBed.createComponent(NotebookComponent);
    const text = 'D6 > E3 60 ATT E1 NC '.repeat(8).trim();
    for (const alignment of ['left', 'center', 'right'] as const) {
      const settings = defaultNotebook(); settings.page.alignment = alignment; settings.page.rowsPerPage = 2;
      fixture.componentRef.setInput('settings', settings);
      fixture.componentRef.setInput('notes', [{ text }]); fixture.detectChanges();
      expect(fixture.componentInstance.error).toBeNull();
      const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.notebook-pages .notebook-row'))
        .filter(row => row.querySelector('.note-block'));
      expect(rows.length).toBeGreaterThan(1);
      for (const row of rows) {
        const blocks = Array.from(row.querySelectorAll<HTMLElement>('.note-block'));
        const bounds = row.getBoundingClientRect(), first = blocks[0].getBoundingClientRect(), last = blocks.at(-1)!.getBoundingClientRect();
        const difference = alignment === 'left' ? first.left - bounds.left : alignment === 'right' ? last.right - bounds.right : (first.left + last.right - bounds.left - bounds.right) / 2;
        expect(Math.abs(difference)).toBeLessThan(1); expect(row.classList.contains('ruled')).toBeTrue();
      }
      expect(Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.notebook-pages .note-element')).filter(node => node.textContent === 'ATT').length).toBe(8);
      const done = fixture.componentInstance.print();
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Caderno para impressão"]')!;
      spyOn(frame.contentWindow!, 'print'); await done;
      expect(frame.contentDocument!.querySelector<HTMLElement>('.notebook-row')!.style.justifyContent).toBe(alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center');
      expect(frame.contentDocument!.querySelector('.notebook-pages')!.textContent).toContain('ATT');
    }
    fixture.destroy();
  });
  it('wraps full sequences, includes observations and obeys rows per page', () => {
    const fixture = TestBed.createComponent(NotebookComponent);
    const settings = defaultNotebook(); settings.page.rowsPerPage = 2;
    fixture.componentRef.setInput('settings', settings);
    fixture.componentRef.setInput('notes', Array.from({ length: 5 }, (_, index) => ({ text: `E6++ nt ${index}`, speedRating: 'observação preservada' })));
    fixture.detectChanges();
    const view = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.error).toBeNull();
    expect(view.querySelectorAll('.notebook-page').length).toBe(5);
    expect(view.querySelectorAll('.notebook-row').length).toBe(10);
    expect(view.querySelector('.notebook-pages')!.textContent).toContain('observação');
    expect(view.querySelectorAll('.notebook-row.ruled').length).toBe(10);
    fixture.destroy();
  });
  it('keeps multiple occupants of the same position adjacent rather than overlapping', () => {
    const fixture = TestBed.createComponent(NotebookComponent);
    fixture.componentRef.setInput('notes', [{ text: 'E6++ +' }]); fixture.detectChanges();
    const elements = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.notebook-pages .note-element'));
    const plus = elements.find(element => element.textContent?.trim() === '++')!.getBoundingClientRect();
    const single = elements.find(element => element.textContent?.trim() === '+')!.getBoundingClientRect();
    expect(single.left).toBeGreaterThanOrEqual(plus.right - .1);
    fixture.destroy();
  });
  it('blocks oversized blocks with an actionable error and never shrinks text', () => {
    const fixture = TestBed.createComponent(NotebookComponent);
    fixture.componentRef.setInput('notes', [{ text: 'X'.repeat(500) }]); fixture.detectChanges();
    expect(fixture.componentInstance.error).toContain('nota 1 não cabe');
    expect((fixture.nativeElement as HTMLElement).querySelector('button')!.disabled).toBeTrue();
    expect(fixture.componentInstance.settings.page.fontPt).toBe(24);
    fixture.componentInstance.print();
    expect(document.querySelector('iframe[title="Caderno para impressão"]')).toBeNull();
    fixture.destroy();
  });
  it('blocks insufficient row height and invalid page settings', () => {
    const fixture = TestBed.createComponent(NotebookComponent);
    const settings = defaultNotebook(); settings.page.rowsPerPage = 24; settings.page.fontPt = 48;
    fixture.componentRef.setInput('settings', settings);
    fixture.componentRef.setInput('notes', [{ text: 'E6++ nt' }]); fixture.detectChanges();
    expect(fixture.componentInstance.error).toContain('não cabe');
    fixture.componentRef.setInput('settings', { ...settings, page: { ...settings.page, marginMm: 100 } }); fixture.detectChanges();
    expect(fixture.componentInstance.error).toContain('Página inválida');
    fixture.destroy();
  });
  it('renders markup as text and clones only notebook pages into the print document', async () => {
    const fixture = TestBed.createComponent(NotebookComponent);
    const settings = defaultNotebook(); settings.page.fontPt = 12;
    fixture.componentRef.setInput('settings', settings);
    fixture.componentRef.setInput('notes', [{ text: '<img src=x onerror=alert(1)>' }]); fixture.detectChanges();
    expect(fixture.componentInstance.error).toBeNull();
    const done = fixture.componentInstance.print();
    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Caderno para impressão"]')!;
    const printing = spyOn(frame.contentWindow!, 'print');
    await done;
    expect(printing).toHaveBeenCalled();
    expect(frame.contentDocument!.querySelectorAll('img').length).toBe(1);
    expect(Array.from(frame.contentDocument!.images).every(img => img.src.endsWith('/assets/brand/recce-studio-logo-rs.png'))).toBeTrue();
    expect(frame.contentDocument!.body.textContent).toContain('onerror=alert(1)>');
    expect(frame.contentDocument!.querySelector('button')).toBeNull();
    expect(frame.contentDocument!.querySelector('style')!.textContent).toContain('size:210mm 297mm');
    fixture.destroy(); expect(document.querySelector('iframe[title="Caderno para impressão"]')).toBeNull();
  });
});

describe('FEAT-004 accessible Studio composition', () => {
  it('preserves word spacing and exposes one complete accessible note instead of fragmented modifiers', () => {
    const fixture = TestBed.createComponent(NoteDisplayComponent);
    fixture.componentRef.setInput('text', 'D3 browser persisted');
    fixture.componentRef.setInput('rules', defaultNotebook().rules); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent?.trim()).toBe('D3 browser persisted');
    expect(root.querySelector('[role=group]')!.getAttribute('aria-label')).toBe('D3 browser persisted');
    expect(root.querySelector('.display-sequence')!.getAttribute('aria-hidden')).toBe('true');
    fixture.destroy();
  });
});

describe('FEAT-004 personal settings persistence', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NotebookSettingsComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads fresh settings on every request without reusing another account model', () => {
    const api = TestBed.inject(NotebookService);
    const first = defaultNotebook(); first.page.fontPt = 30;
    api.load().subscribe(value => expect(value.page.fontPt).toBe(30));
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush(first);
    api.load().subscribe(value => expect(value.page.fontPt).toBe(24));
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush(null, { status: 204, statusText: 'No Content' });
  });
  it('FEAT-009 loads legacy preferences as centered and preserves explicit alignment without auto-saving', () => {
    const api = TestBed.inject(NotebookService);
    const legacy = defaultNotebook(); delete legacy.page.alignment;
    api.load().subscribe(settings => expect(settings.page.alignment).toBe('center'));
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush(legacy);
    const right = defaultNotebook(); right.page.alignment = 'right';
    api.load().subscribe(settings => expect(settings.page.alignment).toBe('right'));
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush(right);
    http.expectNone(request => request.method === 'PUT');
  });
  it('preserves edits on a failed save and requires a successful initial load', () => {
    const fixture = TestBed.createComponent(NotebookSettingsComponent);
    fixture.componentRef.setInput('dictionaryReady', true);
    fixture.componentRef.setInput('dictionaryRules', [{ phrase: 'esquerda um', symbol: 'E1', enabled: true }]);
    fixture.detectChanges();
    const view = fixture.componentInstance;
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush('unavailable', { status: 503, statusText: 'Unavailable' });
    view.save(); http.expectNone(`${API_BASE_URL}/api/notebook-preferences`);
    expect(view.error).toContain('Não foi possível ler');
    view.load(); http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush(defaultNotebook());
    view.settings.rules[0].size = 110; view.save();
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush('unavailable', { status: 503, statusText: 'Unavailable' });
    expect(view.settings.rules[0].size).toBe(110);
    expect(view.error).toContain('Não foi possível guardar');
    fixture.destroy();
  });
});
