import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { NotesComponent } from '../../features/notes/notes.component';
import { SharedProperties } from '../shared/shared-properties';
import { defaultNotebook, displayRule } from './notebook.model';
import { CustomNoteDictionaryRule, NoteDictionaryService } from '../services/note-dictionary.service';
import { API_BASE_URL } from '../services/api.config';
import { defaultBookCover } from './book-cover.model';

describe('FEAT-007 dictionary is the source of presentation symbols', () => {
  let http: HttpTestingController;
  let cache: string | null;
  beforeEach(() => {
    cache = localStorage.getItem('recce_note_dictionary_rules'); localStorage.removeItem('recce_note_dictionary_rules');
    TestBed.configureTestingModule({ imports: [NotesComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: SharedProperties, useValue: { connectionMode$: new BehaviorSubject('online'), success: () => {}, error: () => {}, info: () => {} } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    if (cache === null) localStorage.removeItem('recce_note_dictionary_rules'); else localStorage.setItem('recce_note_dictionary_rules', cache);
  });
  function open(rules: CustomNoteDictionaryRule[] = [], settings = defaultNotebook(), failDictionary = false) {
    const fixture = TestBed.createComponent(NotesComponent); fixture.detectChanges();
    const dictionaryRequest = http.expectOne(`${API_BASE_URL}/api/note-dictionary-rules`);
    http.expectOne(`${API_BASE_URL}/api/team-profile`).flush({ noteSystem: 'Sistema base' });
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush(settings);
    if (failDictionary) dictionaryRequest.flush('unavailable', { status: 503, statusText: 'Unavailable' });
    else dictionaryRequest.flush(rules);
    fixture.componentInstance.area = 'presentation'; fixture.detectChanges();
    return fixture;
  }
  it('does not offer free creation or deletion of symbols in presentation', () => {
    const fixture = open(); const root = fixture.nativeElement as HTMLElement;
    const texts = Array.from(root.querySelectorAll('app-notebook-settings button')).map(button => button.textContent?.trim());
    expect(texts).not.toContain('Adicionar elemento');
    expect(texts.some(text => text?.startsWith('Remover elemento'))).toBeFalse();
    fixture.destroy();
  });
  it('starts compact with contextual help and secondary actions closed, without hiding the scope', () => {
    const fixture = open(); const root = fixture.nativeElement as HTMLElement;
    for (const selector of ['.notes-help', '.context-help', '.secondary-options', '[data-tour="note-system"]']) {
      expect(root.querySelector<HTMLDetailsElement>(selector)!.open).toBeFalse();
    }
    expect(root.querySelector('.scope-label')!.textContent).toBe('Pessoal');
    expect(Array.from(root.querySelectorAll<HTMLElement>('.notes-header p')).every(p => !p.checkVisibility())).toBeTrue();
    const help = root.querySelector<HTMLDetailsElement>('.notes-help')!;
    help.querySelector('summary')!.click(); fixture.detectChanges();
    expect(help.open).toBeTrue();
    expect(help.textContent).toContain('Mostrar ajuda guiada');
    http.expectNone(request => request.method !== 'GET'); fixture.destroy();
  });
  it('shows only the selected editor and retains styles across selection, help and area switches', () => {
    const fixture = open(); const view = fixture.componentInstance; const personal = view.personalSettings!;
    expect(fixture.nativeElement.querySelectorAll('.dictionary > details.rule').length).toBe(0);
    const count = personal.settings.rules.length;
    personal.selectSymbol('E6'); fixture.detectChanges();
    personal.settings.rules.find(rule => rule.match === 'E6')!.size = 115; personal.refresh();
    personal.selectSymbol('D6'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.dictionary > details.rule').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.dictionary > details.rule summary').textContent).toContain('D6');
    fixture.nativeElement.querySelector('.context-help > summary').click();
    view.area = 'notebook'; fixture.detectChanges();
    http.expectOne(`${API_BASE_URL}/api/reccebook-template`).flush({ cover: defaultBookCover(), editable: true });
    view.area = 'presentation'; fixture.detectChanges(); personal.selectSymbol('E6'); fixture.detectChanges();
    expect(personal.settings.rules.find(rule => rule.match === 'E6')!.size).toBe(115);
    expect(personal.settings.rules.length).toBe(count);
    http.expectNone(request => request.method !== 'GET'); fixture.destroy();
  });
  it('loads dictionary identity as read-only while keeping layout editable', () => {
    const fixture = open(); const root = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.personalSettings!.selectSymbol('E6'); fixture.detectChanges();
    const rule = Array.from(root.querySelectorAll<HTMLDetailsElement>('app-notebook-settings details')).find(detail => detail.querySelector('summary')?.textContent?.startsWith('E6 →'))!;
    rule.open = true;
    const inputs = Array.from(rule.querySelectorAll<HTMLInputElement>('input'));
    expect(inputs.slice(0, 3).every(input => input.readOnly)).toBeTrue();
    expect(rule.querySelector<HTMLSelectElement>('select[aria-label="Posição"]')!.disabled).toBeFalse();
    fixture.destroy();
  });

  it('offers one symbol for aliases, refuses unknown symbols and follows dictionary meaning changes without losing layout', () => {
    const aliases = [
      { id: 'one', phrase: 'curva teste', symbol: 'Z6', meaning: 'Primeiro significado', enabled: true },
      { id: 'two', phrase: 'outra frase', symbol: 'Z6', meaning: 'Primeiro significado', enabled: true },
    ];
    const fixture = open(aliases); const personal = fixture.componentInstance.personalSettings!;
    expect(personal.dictionarySymbols.filter(rule => rule.symbol === 'Z6').length).toBe(1);
    const count = personal.settings.rules.length;
    expect(personal.selectSymbol('UNKNOWN')).toBeFalse(); expect(personal.settings.rules.length).toBe(count);
    expect(personal.selectSymbol('Z6')).toBeTrue();
    personal.settings.rules.find(rule => rule.match === 'Z6')!.position = 'top-left';
    personal.selectSymbol('Z6'); expect(personal.settings.rules.length).toBe(count + 1);
    const dictionary = TestBed.inject(NoteDictionaryService);
    dictionary.updateRule('two', { ...aliases[1], meaning: 'Atualizado no Dicionário' }).subscribe();
    http.expectOne(`${API_BASE_URL}/api/note-dictionary-rules/two`).flush({ ...aliases[1], meaning: 'Atualizado no Dicionário' });
    fixture.detectChanges();
    const linked = personal.settings.rules.find(rule => rule.match === 'Z6')!;
    expect(linked.meaning).toBe('Atualizado no Dicionário'); expect(linked.position).toBe('top-left');
    http.expectNone(request => request.method === 'PUT'); fixture.destroy();
  });

  it('preserves orphan styles and only unlinks a symbol when its last alias is removed', () => {
    const model = defaultNotebook(); const legacy = { ...displayRule('OLD'), display: 'Legacy display', size: 130 };
    model.rules.push(legacy, { ...displayRule('Z6'), underline: true });
    const aliases = [{ id: 'one', phrase: 'teste', symbol: 'Z6', enabled: true }, { id: 'two', phrase: 'alias', symbol: 'Z6', enabled: true }];
    const fixture = open(aliases, model); const personal = fixture.componentInstance.personalSettings!;
    expect(personal.presentationRules.some(rule => rule.match === 'OLD')).toBeFalse();
    expect(personal.unlinkedRules.find(rule => rule.match === 'OLD')).toEqual(legacy);
    const dictionary = TestBed.inject(NoteDictionaryService);
    for (const id of ['one', 'two']) {
      dictionary.deleteRule(id).subscribe();
      http.expectOne(`${API_BASE_URL}/api/note-dictionary-rules/${id}`).flush(null);
      fixture.detectChanges();
      expect(personal.presentationRules.some(rule => rule.match === 'Z6')).toBe(id === 'one');
    }
    personal.save();
    const write = http.expectOne(`${API_BASE_URL}/api/notebook-preferences`);
    expect(write.request.body.rules.find((rule: {match: string}) => rule.match === 'OLD')).toEqual(legacy);
    expect(write.request.body.rules.find((rule: {match: string}) => rule.match === 'Z6').underline).toBeTrue();
    write.flush(write.request.body);
    fixture.destroy();
  });

  it('requires a confirmed dictionary and preserves the draft through failure and retry', () => {
    const fixture = open([], defaultNotebook(), true); const personal = fixture.componentInstance.personalSettings!;
    expect(fixture.nativeElement.querySelector('app-notebook-settings fieldset').disabled).toBeTrue();
    expect(personal.selectSymbol('E6')).toBeFalse(); personal.save();
    http.expectNone(request => request.method === 'PUT');
    fixture.componentInstance.loadRules();
    http.expectOne(`${API_BASE_URL}/api/note-dictionary-rules`).flush([]); fixture.detectChanges();
    expect(personal.selectSymbol('E6')).toBeTrue();
    personal.settings.rules.find(rule => rule.match === 'E6')!.size = 120;
    personal.save();
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush('unavailable', { status: 503, statusText: 'Unavailable' });
    expect(personal.settings.rules.find(rule => rule.match === 'E6')!.size).toBe(120);
    expect(personal.error).toContain('Não foi possível guardar'); fixture.destroy();
  });

  it('does not delete old data to make room for a new presentation and ignores invalid dictionary symbols', () => {
    const model = defaultNotebook(); model.rules = Array.from({ length: 250 }, (_, at) => displayRule(`OLD${at}`));
    const fixture = open([{ phrase: 'válido', symbol: 'Z6', enabled: true }, { phrase: 'longo', symbol: 'X'.repeat(41), enabled: true }], model);
    const personal = fixture.componentInstance.personalSettings!;
    expect(personal.dictionarySymbols.some(rule => rule.symbol.length > 40)).toBeFalse();
    expect(personal.selectSymbol('Z6')).toBeFalse(); expect(personal.error).toContain('250');
    expect(personal.settings.rules).toEqual(model.rules);
    personal.reset();
    expect(personal.settings.rules).toEqual(model.rules);
    expect(personal.settings.rules.some(rule => rule.match === 'E6')).toBeFalse();
    fixture.destroy();
  });
});
