import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { LoginComponent } from './modules/core/components/login/login.component';
import { AuthService } from './modules/core/services/auth.service';
import { OfflineRecceSession, OfflineRecceStoreService } from './modules/core/services/offline-recce-store.service';
import { OfflineReccesComponent } from './modules/features/offline-recces/offline-recces.component';
import { PecsListComponent } from './modules/features/pecs/pecs-list/pecs-list.component';
import { RallyDetailComponent } from './modules/features/pecs/rally-detail/rally-detail.component';
import { PecDetailComponent } from './modules/features/pecs/pec-detail/pec-detail.component';
import { PecsEditorComponent } from './modules/features/pecs/pecs-editor/pecs-editor.component';
import { TeamProfileComponent } from './modules/features/team-profile/team-profile.component';
import { SharedProperties } from './modules/core/shared/shared-properties';
import { defaultNotebook } from './modules/core/notebook/notebook.model';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

describe('AUD-ACC-001 rendered form names', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: AuthService, useValue: { isAuthenticated: () => true, isOfflineSession: () => false } },
      { provide: OfflineRecceStoreService, useValue: { canAccessSession: () => true } },
      { provide: SharedProperties, useValue: { connectionMode$: new BehaviorSubject('online') } }],
  }));

  afterEach(() => TestBed.inject(HttpTestingController).expectNone(() => true));

  // Render real conditional templates, isolating loading/persistence from this label regression.
  function render<T>(type: Type<T>, state: Partial<T>): ComponentFixture<T> {
    const prototype = type.prototype as { ngOnInit?: () => void };
    if (prototype.ngOnInit) spyOn(prototype as { ngOnInit: () => void }, 'ngOnInit').and.stub();
    const fixture = TestBed.createComponent(type);
    Object.assign(fixture.componentInstance as object, state);
    fixture.detectChanges();
    return fixture;
  }

  function name(control: Control): string {
    const references = control.getAttribute('aria-labelledby');
    if (references) return references.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    return control.getAttribute('aria-label') || Array.from(control.labels || []).map(label => label.textContent).join(' ').trim()
      || control.title;
  }

  function assertNamed(root: HTMLElement, expected: number): Control[] {
    const controls = Array.from(root.querySelectorAll<Control>('input:not([type=file]), select, textarea'));
    expect(controls.length).toBe(expected);
    controls.forEach(control => expect(name(control)).withContext(control.outerHTML).not.toBe(''));
    const ids = Array.from(root.querySelectorAll('[id]')).map(element => element.id);
    expect(new Set(ids).size).withContext('No duplicated IDs in the rendered template').toBe(ids.length);
    return controls;
  }

  function assertLabelFocus(root: HTMLElement): void {
    root.querySelectorAll<HTMLLabelElement>('label[for]').forEach(label => {
      expect(label.control).withContext(label.outerHTML).not.toBeNull();
      label.click();
      expect(document.activeElement).withContext(label.textContent || '').toBe(label.control);
    });
  }

  it('names login credentials and focuses the matching input on label activation', () => {
    // Prevent constructor navigation; no credentials or persistent authentication are used.
    TestBed.overrideProvider(AuthService, { useValue: { isAuthenticated: () => false } });
    const fixture = render(LoginComponent, { isBrowserOffline: false });
    const controls = assertNamed(fixture.nativeElement, 2);
    expect(controls.map(name)).toEqual(['Email', 'Password']);
    assertLabelFocus(fixture.nativeElement);
  });

  it('names rally search/filters and keeps visible creation labels associated', () => {
    const fixture = render(PecsListComponent, { isCreatingRally: true });
    const controls = assertNamed(fixture.nativeElement, 12);
    expect(controls.slice(0, 6).map(name)).toEqual(['Pesquisar ralis', 'Filtrar ralis por estado',
      'Filtrar ralis por piso', 'Filtrar ralis por ano', 'Filtrar ralis por carro', 'Filtrar ralis por classe']);
    assertLabelFocus(fixture.nativeElement);
  });

  it('names PEC search and the creation dialog with clickable labels', () => {
    const fixture = render(RallyDetailComponent, { showCreateModal: true });
    assertNamed(fixture.nativeElement, 4);
    assertLabelFocus(fixture.nativeElement);
  });

  it('names compact PEC metadata fields without relying on placeholders', () => {
    const fixture = render(PecDetailComponent, { isLoadingPec: false, isEditingPec: true });
    expect(assertNamed(fixture.nativeElement, 3).map(name)).toEqual(['Número da PEC', 'Nome da PEC', 'Distância da PEC (km)']);
  });

  it('distinguishes new-note and existing-note controls, including the timestamp unit', () => {
    const fixture = render(PecsEditorComponent, { pecId: 'fixture', isAddingNote: true,
      notes: [{ id: 'note', text: 'D3', speedRating: '', originalTimestamp: 0 }] });
    expect(assertNamed(fixture.nativeElement, 4).map(name)).toEqual(['Desfasamento vídeo/reconhecimento (s)', 'Largura do painel de notas', 'Texto da nova nota', 'Observações da nova nota']);
    fixture.componentInstance.isAddingNote = false; fixture.componentInstance.editingNoteId = 'note'; fixture.detectChanges();
    const names = assertNamed(fixture.nativeElement, 6).map(name);
    expect(names).toEqual(['Desfasamento vídeo/reconhecimento (s)', 'Largura do painel de notas', 'Texto da nota',
      'Observações da nota', 'Tempo da nota no vídeo (segundos)', 'Mover notas seguintes que já têm tempo']);
  });

  it('names team/car fields and conditional custom choices after switching to Outro', () => {
    const fixture = render(TeamProfileComponent, { isEditing: true });
    const profile = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(':scope > div')!;
    assertNamed(profile, 7);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-notebook-settings')).toBeNull();
    expect(profile.querySelector('#team-note-system')).toBeNull();
    fixture.componentInstance.selectedClassOption = 'Outro';
    fixture.detectChanges();
    const names = assertNamed(profile, 8).map(name);
    expect(names).toContain('Classe personalizada');
    expect(names).toContain('Unidade de Medida');
    assertLabelFocus(fixture.nativeElement);
  });

  it('keeps offline labels attached to the right session when the expanded form changes', () => {
    const session = (id: string): OfflineRecceSession => ({ id, deviceId: 'fixture', userEmail: 'fixture@example.test',
      status: 'ready_to_sync', temporaryName: id, createdAt: '2026-10-23', updatedAt: '2026-10-23',
      notesCount: 0, durationSeconds: 0, markers: [], gpsTrack: [] });
    const fixture = render(OfflineReccesComponent, { isLoading: false, sessions: [session('first'), session('second')],
      expandedCreateSessionId: 'first', newPecDrafts: {
        first: { rallyId: '', number: 1, name: '', distanceKm: 0 },
        second: { rallyId: '', number: 2, name: '', distanceKm: 0 },
      } });
    for (const id of ['first', 'second']) {
      fixture.componentInstance.expandedCreateSessionId = id;
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      const fields = assertNamed(root, 6).filter(control => control.hasAttribute('aria-labelledby'));
      expect(fields.map(name)).toEqual(['Rali', 'Numero', 'Nome da PEC', 'Distancia km']);
      expect(fields.length).toBe(4);
      fields.forEach(control => {
        expect(control.closest('article')?.textContent).toContain(id);
        expect(control.labels?.length).toBe(1);
        expect(control.labels?.[0].control).toBe(control);
      });
      assertLabelFocus(root);
    }
  });
});
