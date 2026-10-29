import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { WorkflowTourComponent } from './workflow-tour.component';
import { WorkflowDemoComponent } from './workflow-demo.component';
import { WorkflowDemoStore } from './workflow-demo.providers';
import { GuidedTourComponent } from './guided-tour.component';
import { SharedProperties } from '../../core/shared/shared-properties';
import { RallyService } from '../../core/services/rally.service';
import { workflowGuides } from './workflow-tour.steps';

describe('FEAT-011 workflow tutorials', () => {
  let fixture: ComponentFixture<WorkflowTourComponent>;
  let storage: string;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  function create(kind: string, offline = false) {
    params = new BehaviorSubject(convertToParamMap({ workflow: kind }));
    TestBed.configureTestingModule({ imports: [WorkflowTourComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: SharedProperties, useValue: { connectionMode$: new BehaviorSubject(offline ? 'offline' : 'online') } },
    ] });
    fixture = TestBed.createComponent(WorkflowTourComponent); fixture.detectChanges();
    return fixture.componentInstance;
  }
  beforeEach(() => { storage = JSON.stringify(localStorage); });
  afterEach(() => {
    TestBed.inject(HttpTestingController).expectNone(() => true);
    fixture?.destroy(); expect(JSON.stringify(localStorage)).toBe(storage);
  });

  for (const kind of ['rally', 'pec', 'recce', 'studio', 'team', 'offline']) {
    it(`completes ${kind} and reverses without duplicating fixtures or using HTTP/storage`, () => {
      const tour = create(kind);
      const demoDebug = fixture.debugElement.query(By.directive(WorkflowDemoComponent));
      const demo = demoDebug.componentInstance as WorkflowDemoComponent;
      expect(demoDebug.injector.get(RallyService) as unknown).toBe(demo.memory);
      const titles: string[] = [];
      while (tour.index < tour.guide!.steps.length - 1) {
        titles.push(tour.guide!.steps[tour.index].title);
        tour.next(); fixture.detectChanges();
      }
      expect(new Set(titles).size).toBe(titles.length);
      if (kind === 'rally') { expect(demo.memory.rallies).toHaveSize(1); expect(demo.rallies!.rallies[0].name).toBe('Rali de exemplo'); }
      if (kind === 'pec') { expect(demo.memory.pecs).toHaveSize(1); expect(demo.pecs!.rally.pecs[0].distanceKm).toBe(8.5); }
      if (kind === 'recce') expect(fixture.nativeElement.textContent).toContain('pronta a sincronizar');
      if (kind === 'studio') expect(fixture.nativeElement.querySelector('app-notebook')).not.toBeNull();
      if (kind === 'team') expect(fixture.nativeElement.textContent).toContain('Sistema base: partilhado');
      if (kind === 'offline') expect(fixture.nativeElement.textContent).toContain('Sessão mantida');
      const last = tour.index; tour.next(); expect(tour.index).toBe(last);
      tour.previous(); fixture.detectChanges(); tour.next(); fixture.detectChanges();
      expect(demo.memory.rallies.length).toBeLessThanOrEqual(1); expect(demo.memory.pecs.length).toBeLessThanOrEqual(1);
      tour.index = 0; fixture.detectChanges(); tour.previous(); expect(tour.index).toBe(0);
      expect(fixture.nativeElement.querySelector('.workflow-demo').inert).toBeTrue();
    });
  }

  it('fails closed for an unknown/prototype route and resets when choosing another workflow', () => {
    const tour = create('__proto__'); expect(tour.guide).toBeUndefined();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Tutorial indisponível');
    params.next(convertToParamMap({ workflow: 'rally' })); fixture.detectChanges();
    tour.next(); fixture.detectChanges(); expect(tour.index).toBe(1);
    params.next(convertToParamMap({ workflow: 'pec' })); fixture.detectChanges();
    expect(tour.kind).toBe('pec'); expect(tour.index).toBe(0);
  });

  it('keeps the offline session global and routes practice to an allowed real destination', () => {
    const tour = create('rally', true);
    const router = TestBed.inject(Router); const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const demo = fixture.debugElement.query(By.directive(WorkflowDemoComponent)).injector;
    expect(demo.get(SharedProperties).connectionMode$.value).toBe('online');
    expect(TestBed.inject(SharedProperties).connectionMode$.value).toBe('offline');
    tour.leave(true); expect(navigate).toHaveBeenCalledWith('/offline-recces');
    tour.leave(); expect(navigate).toHaveBeenCalledWith('/tutorial');
    expect(tour.practiceLabel).toBe('Ir para reconhecimentos offline');
    for (const kind of ['team', 'offline']) {
      params.next(convertToParamMap({ workflow: kind })); fixture.detectChanges();
      tour.leave(true); expect(navigate.calls.mostRecent().args).toEqual(['/offline-recces']);
      expect(TestBed.inject(SharedProperties).connectionMode$.value).toBe('offline');
      expect(fixture.nativeElement.querySelector('app-team-profile,app-offline-recces')).toBeNull();
    }
  });

  it('only leaves for fixed practice routes after an explicit action, without example IDs', () => {
    const tour = create('recce');
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    expect(navigate).not.toHaveBeenCalled();
    tour.leave(true); expect(navigate).toHaveBeenCalledWith('/new-recce');
    params.next(convertToParamMap({ workflow: 'studio' })); fixture.detectChanges();
    tour.leave(true); expect(navigate).toHaveBeenCalledWith('/pecs');
    params.next(convertToParamMap({ workflow: 'team' })); fixture.detectChanges();
    tour.leave(true); expect(navigate).toHaveBeenCalledWith('/team-profile');
    params.next(convertToParamMap({ workflow: 'offline' })); fixture.detectChanges();
    tour.leave(true); expect(navigate).toHaveBeenCalledWith('/offline-recces');
  });

  it('uses native modal keyboard controls with a focus cycle, escape and explicit progression', async () => {
    create('recce'); await new Promise(resolve => setTimeout(resolve, 50)); fixture.detectChanges();
    const overlay = fixture.debugElement.query(By.directive(GuidedTourComponent)).componentInstance as GuidedTourComponent;
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue(); expect(document.activeElement?.id).toBe('workflow-tour-title');
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    buttons.at(-1)!.focus(); const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); overlay.trapFocus(tab);
    expect(tab.defaultPrevented).toBeTrue(); expect(document.activeElement).toBe(buttons[0]);
    const backwards = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); overlay.trapFocus(backwards);
    expect(document.activeElement).toBe(buttons.at(-1)!);
    const exit = spyOn(overlay.exit, 'emit'); const event = new Event('cancel', { cancelable: true }); overlay.cancel(event);
    expect(event.defaultPrevented).toBeTrue(); expect(exit).toHaveBeenCalled();
  });

  it('does not instantiate recording, tracking, media players or real PEC editors', () => {
    create('recce');
    expect(fixture.nativeElement.querySelector('app-recce-mode,video,audio,app-pecs-editor')).toBeNull();
    params.next(convertToParamMap({ workflow: 'studio' })); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-recce-mode,video,audio,app-pecs-editor')).toBeNull();
    expect(workflowGuides.size).toBe(6);
    expect(new WorkflowDemoStore().rallies).toEqual([]);
  });
  it('keeps the dark media placeholder readable when surrounding text uses a light theme', () => {
    create('studio'); fixture.nativeElement.style.color = 'rgb(15, 23, 42)'; fixture.detectChanges();
    const style = getComputedStyle(fixture.nativeElement.querySelector('.demo-media'));
    const luminance = (color: string) => color.match(/\d+/g)!.slice(0, 3).map(value => {
      const channel = Number(value) / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const foreground = luminance(style.color), background = luminance(style.backgroundColor);
    expect((Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)).toBeGreaterThanOrEqual(4.5);
  });
});
