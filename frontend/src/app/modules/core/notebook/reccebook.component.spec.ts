import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { defaultBookCover, coverText, coverError } from './book-cover.model';
import { NotebookComponent } from './notebook.component';
import { RecceBookComponent } from './reccebook.component';
import { defaultNotebook } from './notebook.model';
import { API_BASE_URL } from '../services/api.config';

describe('FEAT-017 cover schema and measured print layout', () => {
  it('rejects branding/HTML/CSS fields, invalid styles and out-of-bounds coordinates', () => {
    const valid = defaultBookCover(); expect(coverError(valid)).toBeNull();
    expect(coverError({ ...valid, logo: 'hidden' } as typeof valid)).not.toBeNull();
    for (const invalid of [{ x: -1 }, { x: 90, width: 50 }, { fontPt: 1000 }, { font: 'url(x)' }, { color: 'red;display:none' }, { bold: 'true' }]) {
      const model = defaultBookCover(); Object.assign(model.front.elements[0], invalid); expect(coverError(model)).not.toBeNull();
    }
    const markup = defaultBookCover(); markup.front.elements[0].text = '<img onerror=alert(1)>'; expect(coverError(markup)).toBeNull();
  });
  it('renders cover first, notes in the middle, back last and immutable branding without interpreting markup', () => {
    const fixture = TestBed.createComponent(NotebookComponent), cover = defaultBookCover(); cover.front.elements[0].text = '<script>literal</script>';
    fixture.componentRef.setInput('cover', cover); fixture.componentRef.setInput('notes', [{ text: 'D6 ATT' }]); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const sheets = root.querySelectorAll('.book-sheet'); expect(sheets.length).toBe(3);
    expect(sheets[0].getAttribute('aria-label')).toBe('Capa'); expect(sheets[2].getAttribute('aria-label')).toBe('Contracapa');
    expect(sheets[0].textContent).toContain('<script>literal</script>'); expect(sheets[0].querySelector('script')).toBeNull();
    expect(root.querySelectorAll('img.cover-brand').length).toBe(1); expect(sheets[2].textContent).toContain('Official product by Recce Studio');
    fixture.destroy();
  });
  it('blocks overlapping and overflowing cover text instead of clipping or shrinking', () => {
    const fixture = TestBed.createComponent(NotebookComponent), cover = defaultBookCover();
    cover.front.elements.push(coverText('Overlap')); fixture.componentRef.setInput('cover', cover); fixture.detectChanges();
    expect(fixture.componentInstance.coverLayoutError).toContain('sobrepõe'); expect(fixture.nativeElement.querySelector('button').disabled).toBeTrue();
    const next = defaultBookCover(); next.front.elements[0].text = 'Long text '.repeat(100); next.front.elements[0].fontPt = 72;
    fixture.componentRef.setInput('cover', next); fixture.detectChanges(); expect(fixture.componentInstance.coverLayoutError).toContain('não cabe'); expect(next.front.elements[0].fontPt).toBe(72);
    fixture.destroy();
  });
  it('ignores an abandoned print image failure when a newer print is active', async () => {
    const pending: { resolve: () => void; reject: (e: Error) => void }[] = [];
    const fixture = TestBed.createComponent(NotebookComponent); fixture.componentRef.setInput('cover', defaultBookCover()); fixture.detectChanges();
    const first = fixture.componentInstance.print(); const firstFrame = document.querySelector<HTMLIFrameElement>('iframe[title="Caderno para impressão"]')!;
    spyOn(firstFrame.contentDocument!.images[0], 'decode').and.callFake(() => new Promise<void>((resolve, reject) => pending.push({ resolve, reject })));
    await firstFrame.contentDocument!.fonts.ready; await Promise.resolve(); expect(pending.length).toBe(1);
    const second = fixture.componentInstance.print(); const secondFrame = document.querySelector<HTMLIFrameElement>('iframe[title="Caderno para impressão"]')!;
    spyOn(secondFrame.contentDocument!.images[0], 'decode').and.callFake(() => new Promise<void>((resolve, reject) => pending.push({ resolve, reject })));
    const printed = spyOn(secondFrame.contentWindow!, 'print'); await secondFrame.contentDocument!.fonts.ready; await Promise.resolve(); expect(pending.length).toBe(2);
    pending[0].reject(new Error('abandoned')); await first; expect(fixture.componentInstance.printError).toBe('');
    pending[1].resolve(); await second; expect(printed).toHaveBeenCalled(); fixture.destroy();
  });
  it('supports cover-only books and all existing page formats/orientations', () => {
    const fixture = TestBed.createComponent(NotebookComponent);
    for (const format of ['A4', 'A5'] as const) for (const orientation of ['portrait', 'landscape'] as const) {
      const settings = defaultNotebook(); settings.page.format = format; settings.page.orientation = orientation;
      fixture.componentRef.setInput('settings', settings); fixture.detectChanges();
      expect(fixture.componentInstance.error).toBeNull(); expect(fixture.nativeElement.querySelectorAll('.book-sheet').length).toBe(2);
      expect(fixture.nativeElement.querySelector('button').disabled).toBeFalse();
    }
    fixture.destroy();
  });
});

describe('FEAT-017 PEC cover editor persistence', () => {
  let http: HttpTestingController;
  const endpoint = `${API_BASE_URL}/api/pecs/p1/reccebook-cover`;
  beforeEach(() => { TestBed.configureTestingModule({ imports: [RecceBookComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  function setup(editable = true) {
    const fixture = TestBed.createComponent(RecceBookComponent); fixture.componentRef.setInput('pecId', 'p1'); fixture.detectChanges();
    http.expectOne(endpoint).flush({ cover: defaultBookCover(), editable }); fixture.detectChanges(); return fixture;
  }
  it('edits and persists the personal main cover without any PEC writes', () => {
    const fixture = TestBed.createComponent(RecceBookComponent); fixture.componentRef.setInput('personal', true); fixture.detectChanges();
    const url = `${API_BASE_URL}/api/reccebook-template`;
    http.expectOne(url).flush({ cover: defaultBookCover(), editable: true }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Editar capa principal'); const view = fixture.componentInstance;
    view.edit(); view.draft.front.elements[0].text = 'Livro pessoal'; view.changed(); fixture.detectChanges(); view.save();
    http.expectOne(url).flush('failed', { status: 503, statusText: 'Unavailable' }); expect(view.hasUnsavedChanges).toBeTrue();
    view.save(); const put = http.expectOne(url); expect(put.request.method).toBe('PUT'); put.flush(view.draft);
    expect(view.cover.front.elements[0].text).toBe('Livro pessoal'); expect(view.hasUnsavedChanges).toBeFalse();
    view.edit(); view.draft.front.elements[0].text = 'Cancelado'; view.cancel(); expect(view.draft.front.elements[0].text).toBe('Livro pessoal');
    http.expectNone(r => r.url.includes('/api/pecs/')); fixture.destroy();
  });
  it('cancels without writes, preserves failed saves and saves only to the current PEC', () => {
    const fixture = setup(), view = fixture.componentInstance;
    view.edit(); view.draft.front.elements[0].text = 'Edited'; view.changed(); fixture.detectChanges(); expect(view.hasUnsavedChanges).toBeTrue();
    view.cancel(); fixture.detectChanges(); expect(view.cover.front.elements[0].text).toBe('RecceBook'); http.expectNone(r => r.method === 'PUT');
    view.edit(); view.draft.front.elements[0].text = 'Saved'; view.changed(); fixture.detectChanges(); view.save();
    http.expectOne(endpoint).flush('failed', { status: 503, statusText: 'Unavailable' }); expect(view.draft.front.elements[0].text).toBe('Saved'); expect(view.editing).toBeTrue();
    view.save(); const save = http.expectOne(endpoint); expect(save.request.body.front.elements[0].text).toBe('Saved'); save.flush(view.draft); fixture.detectChanges();
    expect(view.cover.front.elements[0].text).toBe('Saved'); expect(view.hasUnsavedChanges).toBeFalse(); fixture.destroy();
  });
  it('blocks writes after failed loading and while readonly, but allows reading/exporting readonly', () => {
    const fixture = TestBed.createComponent(RecceBookComponent); fixture.componentRef.setInput('pecId', 'p1'); fixture.detectChanges();
    http.expectOne(endpoint).flush('failed', { status: 500, statusText: 'error' }); fixture.detectChanges(); const view = fixture.componentInstance;
    view.edit(); view.save(); http.expectNone(r => r.method === 'PUT'); expect(view.loaded).toBeFalse();
    view.load(); http.expectOne(endpoint).flush({ cover: defaultBookCover(), editable: false }); fixture.detectChanges(); view.edit(); expect(view.editing).toBeFalse();
    expect(fixture.nativeElement.querySelector('app-notebook button').disabled).toBeFalse(); fixture.destroy();
  });
});
