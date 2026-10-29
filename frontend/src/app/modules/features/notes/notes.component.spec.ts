import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { NotesComponent } from './notes.component';
import { TeamProfileComponent } from '../team-profile/team-profile.component';
import { SharedProperties } from '../../core/shared/shared-properties';
import { ConfirmDialogService } from '../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { RecceNoteParserService } from '../../core/services/recce-note-parser.service';
import { defaultNotebook } from '../../core/notebook/notebook.model';
import { API_BASE_URL } from '../../core/services/api.config';

describe('FEAT-005 centralized note settings', () => {
  let http: HttpTestingController;
  let previousCache: string | null;
  beforeEach(() => {
    previousCache = localStorage.getItem('recce_note_dictionary_rules');
    localStorage.removeItem('recce_note_dictionary_rules');
    TestBed.configureTestingModule({ imports: [NotesComponent, TeamProfileComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: SharedProperties, useValue: { connectionMode$: new BehaviorSubject('online'), success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), info: jasmine.createSpy('info') } },
      { provide: ConfirmDialogService, useValue: {} },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    if (previousCache === null) localStorage.removeItem('recce_note_dictionary_rules');
    else localStorage.setItem('recce_note_dictionary_rules', previousCache);
  });
  function open() {
    const fixture = TestBed.createComponent(NotesComponent); fixture.detectChanges();
    http.expectOne(`${API_BASE_URL}/api/note-dictionary-rules`).flush([]);
    http.expectOne(`${API_BASE_URL}/api/team-profile`).flush({ noteSystem: 'Equipa inicial' });
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush(defaultNotebook());
    fixture.detectChanges(); return fixture;
  }
  it('shows real scopes, keeps one personal instance and retains drafts when switching areas', () => {
    const fixture = open(); const view = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Partilhado com a equipa');
    expect(root.textContent).toContain('Pessoal');
    expect(root.querySelectorAll('app-notebook-settings').length).toBe(1);
    expect(root.querySelector('app-notebook-settings')!.hasAttribute('hidden')).toBeTrue();
    view.area = 'presentation'; fixture.detectChanges();
    const settings = view.personalSettings!;
    settings.settings.rules[0].size = 110; settings.refresh();
    view.area = 'notebook'; fixture.detectChanges();
    settings.settings.page.rowsPerPage = 7; settings.refresh();
    view.area = 'dictionary'; fixture.detectChanges();
    view.area = 'presentation'; fixture.detectChanges();
    expect(view.personalSettings).toBe(settings);
    expect(settings.settings.page.rowsPerPage).toBe(7);
    expect(settings.settings.rules[0].size).toBe(110);
    http.expectNone(request => request.method !== 'GET'); fixture.destroy();
  });
  it('links a dictionary symbol without duplication or overwriting existing personal styles', () => {
    const fixture = open(); const settings = fixture.componentInstance.personalSettings!;
    const existing = settings.settings.rules.find(rule => rule.match === 'E6')!;
    existing.position = 'bottom-left'; existing.display = 'Custom';
    const count = settings.settings.rules.length;
    expect(settings.selectSymbol('E6')).toBeTrue();
    expect(settings.settings.rules.length).toBe(count);
    expect(settings.settings.rules.find(rule => rule.match === 'E6')!.display).toBe('E6');
    expect(settings.settings.rules.find(rule => rule.match === 'E6')!.position).toBe('bottom-left');
    expect(settings.selectSymbol('Z6')).toBeFalse();
    fixture.componentInstance.form = { phrase: 'curva pessoal', symbol: 'Z6', meaning: 'Curva pessoal', enabled: true };
    fixture.componentInstance.saveRule();
    http.expectOne(`${API_BASE_URL}/api/note-dictionary-rules`).flush({ id: 'personal', phrase: 'curva pessoal', symbol: 'Z6', meaning: 'Curva pessoal', enabled: true });
    fixture.detectChanges();
    expect(settings.selectSymbol('Z6')).toBeTrue();
    expect(settings.settings.rules.at(-1)!.match).toBe('Z6');
    expect(settings.settings.rules.at(-1)!.display).toBe('Z6');
    expect(settings.settings.rules.at(-1)!.meaning).toBe('Curva pessoal');
    settings.selectSymbol('Z6'); expect(settings.settings.rules.length).toBe(count + 1);
    settings.loaded = false; expect(settings.selectSymbol('Unavailable')).toBeFalse(); fixture.destroy();
  });
  it('saves only team noteSystem and keeps text on failed persistence', () => {
    const fixture = open(); const view = fixture.componentInstance;
    view.noteSystem = 'Novo sistema'; view.saveNoteSystem();
    const request = http.expectOne(`${API_BASE_URL}/api/team-profile`);
    expect(request.request.method).toBe('PATCH'); expect(request.request.body).toEqual({ noteSystem: 'Novo sistema' });
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(view.noteSystem).toBe('Novo sistema'); expect(view.systemError).toContain('mantido');
    view.noteSystem = ''; view.saveNoteSystem(); http.expectNone(`${API_BASE_URL}/api/team-profile`); fixture.destroy();
  });
  it('saves dictionary meaning and symbol without writing team or personal presentation settings', () => {
    const fixture = open(); const view = fixture.componentInstance;
    view.form = { phrase: 'curva pessoal', meaning: 'Significado', symbol: 'Z6', category: 'curvas', enabled: true };
    view.saveRule(); const request = http.expectOne(`${API_BASE_URL}/api/note-dictionary-rules`);
    expect(request.request.body.meaning).toBe('Significado'); expect(request.request.body.symbol).toBe('Z6');
    request.flush({ ...request.request.body, id: 'personal' });
    expect(TestBed.inject(RecceNoteParserService).parse('curva pessoal').compactText).toBe('Z6');
    http.expectNone(request => request.method !== 'GET'); fixture.destroy();
  });
  it('never resends stale noteSystem when saving the team profile', () => {
    const fixture = TestBed.createComponent(TeamProfileComponent);
    const view = fixture.componentInstance;
    view.draft = { ...view.draft, name: 'Updated team', noteSystem: 'Stale system' };
    view.saveProfile(); const request = http.expectOne(`${API_BASE_URL}/api/team-profile`);
    expect(request.request.body.name).toBe('Updated team');
    expect(Object.prototype.hasOwnProperty.call(request.request.body, 'noteSystem')).toBeFalse();
    request.flush({ ...view.draft, noteSystem: 'New system from Notes' }); fixture.destroy();
  });
  it('shows a recovery action when the personal model cannot be loaded', () => {
    const fixture = TestBed.createComponent(NotesComponent); fixture.detectChanges();
    http.expectOne(`${API_BASE_URL}/api/note-dictionary-rules`).flush([]);
    http.expectOne(`${API_BASE_URL}/api/team-profile`).flush({ noteSystem: 'Existing' });
    http.expectOne(`${API_BASE_URL}/api/notebook-preferences`).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const recovery = Array.from(root.querySelectorAll('button')).find(button => button.textContent?.includes('Abrir apresentação para tentar novamente'))!;
    expect(recovery).toBeTruthy(); recovery.click(); fixture.detectChanges();
    expect(fixture.componentInstance.area).toBe('presentation');
    expect(fixture.componentInstance.personalSettings!.loaded).toBeFalse();
    expect(root.querySelector('app-notebook-settings')!.textContent).toContain('Não foi possível ler');
    http.expectNone(request => request.method !== 'GET'); fixture.destroy();
  });
});
