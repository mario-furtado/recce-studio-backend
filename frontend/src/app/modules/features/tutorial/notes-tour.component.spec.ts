import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotesTourComponent } from './notes-tour.component';
import { DemoDictionary, DemoNotebook, DemoTeamProfile } from './notes-demo.providers';
import { NoteDictionaryService } from '../../core/services/note-dictionary.service';
import { NotebookService } from '../../core/notebook/notebook.service';
import { TeamProfileService } from '../../core/services/team-profile.service';
import { defaultNotebook } from '../../core/notebook/notebook.model';
import { NotebookComponent } from '../../core/notebook/notebook.component';
import { By } from '@angular/platform-browser';
import { SharedProperties } from '../../core/shared/shared-properties';

describe('FEAT-006 guided notes tutorial', () => {
  let fixture: ComponentFixture<NotesTourComponent>;
  let storage: string;
  function create(part = '', path = 'notes/learn') {
    TestBed.configureTestingModule({ imports: [NotesTourComponent], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { routeConfig: { path }, queryParamMap: convertToParamMap({ part }) } } },
    ] });
    TestBed.inject(SharedProperties).connectionMode$.next('online');
    fixture = TestBed.createComponent(NotesTourComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }
  beforeEach(() => { storage = JSON.stringify(localStorage); });
  afterEach(() => {
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(JSON.stringify(localStorage)).toBe(storage);
    fixture?.destroy();
  });

  it('uses only instance-local services, even when real forms save, reload or delete', () => {
    const tour = create();
    const injector = fixture.debugElement.injector;
    expect(injector.get(NoteDictionaryService) as unknown).toBe(injector.get(DemoDictionary));
    expect(injector.get(NotebookService) as unknown).toBe(injector.get(DemoNotebook));
    expect(injector.get(TeamProfileService) as unknown).toBe(injector.get(DemoTeamProfile));
    const notes = tour.notes!;
    notes.form = { phrase: 'exemplo privado', symbol: 'TEST', meaning: 'Sem persistência', enabled: true };
    notes.saveRule();
    expect(notes.rules[0].symbol).toBe('TEST');
    notes.noteSystem = 'Não guardar na equipa'; notes.saveNoteSystem();
    notes.personalSettings!.settings.page.rowsPerPage = 3;
    notes.personalSettings!.save(); notes.personalSettings!.load();
    expect(notes.personalSettings!.settings.page.rowsPerPage).toBe(3);
    injector.get(DemoDictionary).deleteRule(notes.rules[0].id!);
    expect(notes.rules).toEqual([]);
    const fresh = new DemoNotebook();
    fresh.load().subscribe(settings => expect(settings).toEqual(defaultNotebook()));
    new DemoTeamProfile().getProfile().subscribe(profile => expect(profile.noteSystem).toBe('Exemplo editável 1–6'));
    expect(new DemoDictionary().getDisplayRules()).toEqual([]);
  });

  it('demonstrates all areas, scopes, actual settings and navigation without automatic advancement', () => {
    const tour = create();
    const titles: string[] = [];
    for (let index = 1; index <= 11; index++) {
      expect(tour.index).toBe(index);
      titles.push(fixture.nativeElement.querySelector('h2#tour-title').textContent);
      expect(document.activeElement?.id).toBe('tour-title');
      if (index === 3) expect(tour.notes!.form.phrase).toBe('esquerda exemplo');
      if (index === 4) expect(tour.notes!.rules[0].symbol).toBe('E6');
      if (index === 6) {
        expect(tour.notes!.personalSettings!.selectedSymbol).toBe('++');
        const modifier = tour.notes!.personalSettings!.settings.rules.find(rule => rule.match === '++')!;
        expect([modifier.attach, modifier.position, modifier.size]).toEqual(['previous', 'top-right', 60]);
      }
      if (index === 8) expect(tour.notes!.personalSettings!.settings.page.rowsPerPage).toBe(6);
      if (index < 11) tour.next();
    }
    expect(new Set(titles).size).toBe(11);
    expect(fixture.nativeElement.textContent).toContain('Experimentar com as minhas notas');
    tour.previous(); expect(tour.index).toBe(10);
    expect(tour.studioNotes[0].text).toBe('E6++ nt');
  });

  it('has a real overflow warning and restores export after advancing', async () => {
    const tour = create('notebook');
    expect(tour.index).toBe(8); expect(tour.firstIndex).toBe(8); expect(tour.lastIndex).toBe(9);
    tour.next();
    await new Promise(resolve => setTimeout(resolve, 100)); fixture.detectChanges();
    const notebook = fixture.debugElement.query(By.directive(NotebookComponent)).componentInstance as NotebookComponent;
    expect(notebook.error).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-notebook button').disabled).toBeTrue();
    tour.previous();
    await new Promise(resolve => setTimeout(resolve, 100)); fixture.detectChanges();
    expect(notebook.error).toBeNull();
  });

  it('only navigates after explicit actions; cancel exits and practice opens real notes', () => {
    const tour = create('', 'tutorial/notes');
    expect(tour.index).toBe(0); expect(tour.notes).toBeUndefined();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    tour.next(); expect(navigate).toHaveBeenCalledWith(['/notes/learn']);
    const event = new Event('cancel', { cancelable: true });
    tour.cancel(event); expect(event.defaultPrevented).toBeTrue();
    expect(navigateByUrl).toHaveBeenCalledWith('/tutorial');
    tour.exit(true); expect(navigateByUrl).toHaveBeenCalledWith('/notes');
  });

  it('starts independently repeatable sections and defaults safely on an invalid part', () => {
    const tour = create('__proto__');
    expect(tour.index).toBe(1); expect(tour.lastIndex).toBe(11);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeTrue();
    expect(fixture.nativeElement.querySelector('.tour-example').inert).toBeTrue();
  });

  it('keeps Tab and Shift+Tab inside the tutorial controls', () => {
    const tour = create('presentation');
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('dialog button:not(:disabled)')) as HTMLButtonElement[];
    buttons[buttons.length - 1].focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    tour.trapFocus(forward);
    expect(forward.defaultPrevented).toBeTrue(); expect(document.activeElement).toBe(buttons[0]);
    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    tour.trapFocus(backward);
    expect(backward.defaultPrevented).toBeTrue(); expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('ignores section parameters on the introduction route', () => {
    const tour = create('notebook', 'tutorial/notes');
    expect(tour.index).toBe(0); expect(tour.firstIndex).toBe(0); expect(tour.lastIndex).toBe(11);
    expect(fixture.nativeElement.textContent).toContain('Passo 1 de 12');
  });
});
