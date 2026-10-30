import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { TeamProfileComponent } from './team-profile.component';
import { TeamProfileService } from '../../core/services/team-profile.service';
import { RallyService } from '../../core/services/rally.service';
import { ConfirmDialogService } from '../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { SharedProperties } from '../../core/shared/shared-properties';

describe('FEAT-015 team dashboard', () => {
  let api: jasmine.SpyObj<TeamProfileService>;
  let rallies: jasmine.SpyObj<RallyService>;
  let confirm: jasmine.SpyObj<ConfirmDialogService>;
  const profile = { name: 'Equipa Serra', driverName: 'Ana', coDriverName: 'Rui', noteSystem: '1–6', distanceUnit: 'Milhas (mi)' };
  beforeEach(() => {
    api = jasmine.createSpyObj('TeamProfileService', ['getProfile', 'getCars', 'getStats', 'updateProfile', 'selectCar', 'deleteCar']);
    api.getProfile.and.returnValue(of(profile)); api.getCars.and.returnValue(of([]));
    api.getStats.and.returnValue(of({ totalPecs: 12, totalKm: 45.6, activeEvents: 3 }));
    rallies = jasmine.createSpyObj('RallyService', ['getRallies', 'getRallyPecs']); rallies.getRallies.and.returnValue(of([]));
    confirm = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);
    TestBed.configureTestingModule({ imports: [TeamProfileComponent], providers: [provideRouter([]),
      { provide: TeamProfileService, useValue: api }, { provide: RallyService, useValue: rallies },
      { provide: ConfirmDialogService, useValue: confirm }, { provide: SharedProperties, useValue: jasmine.createSpyObj('SharedProperties', ['success', 'error']) }] });
  });
  function render() { const fixture = TestBed.createComponent(TeamProfileComponent); fixture.detectChanges(); return fixture; }
  it('shows real identity/statistics and honest empty states without moving km into miles', () => {
    const fixture = render(), root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('h1')!.textContent).toContain(profile.name);
    expect(root.textContent).toContain('Ana'); expect(root.textContent).toContain('Rui');
    expect(root.querySelector('.team-metrics')!.textContent).toContain('45.6');
    expect(root.querySelector('.team-metrics')!.textContent).toContain('km em recce');
    expect(root.querySelectorAll('.metric-tile').length).toBe(0);
    expect(root.textContent).toContain('Sem viaturas'); expect(root.textContent).toContain('Sem PECs com data');
    expect(root.querySelector('#team-distance-unit')).toBeNull();
  });
  it('puts the active car first without changing source order and editing does not select it', () => {
    const cars = [{ id: 'a', name: 'Reserva', carClass: 'Rally4' }, { id: 'b', name: 'Ativo', carClass: 'Rally2', active: true }];
    api.getCars.and.returnValue(of(cars)); const fixture = render(); fixture.componentInstance.startEdit(); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('article h3')!.textContent).toContain('Ativo'); expect(cars[0].id).toBe('a');
    root.querySelector<HTMLButtonElement>('button[aria-label="Editar Reserva"]')!.click();
    expect(fixture.componentInstance.editingCarId).toBe('a'); expect(api.selectCar).not.toHaveBeenCalled();
    api.selectCar.and.returnValue(of(profile)); root.querySelector<HTMLButtonElement>('button[aria-label="Selecionar Reserva"]')!.click();
    expect(api.selectCar).toHaveBeenCalledOnceWith('a');
  });
  it('keeps the unit in the profile draft and never writes the note system on save', () => {
    const fixture = render(), view = fixture.componentInstance; view.startEdit(); view.draft.distanceUnit = 'Quilometros (km)'; view.cancelEdit();
    expect(view.draft.distanceUnit).toBe('Milhas (mi)'); view.startEdit(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#team-distance-unit')).not.toBeNull();
    view.draft.distanceUnit = 'Quilometros (km)'; api.updateProfile.and.returnValue(of({ ...profile, distanceUnit: view.draft.distanceUnit })); view.saveProfile();
    expect(api.updateProfile.calls.mostRecent().args[0].distanceUnit).toBe('Quilometros (km)');
    expect(api.updateProfile.calls.mostRecent().args[0].noteSystem).toBeUndefined();
  });
  it('sorts only valid actual dates, caps at five and exposes the real PEC link', () => {
    rallies.getRallies.and.returnValue(of([{ id: 'r', name: 'Rali real', pecsCount: 8, year: 2026, surface: 'TERRA', location: 'Serra', icon: '' }]));
    rallies.getRallyPecs.and.returnValue(of([
      ...Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `PEC ${i}`, updatedAt: `2026-10-${10 + i}` })),
      { id: 'bad', name: 'Invalid', updatedAt: '2026-02-30' }, { id: 'absent', name: 'Absent' },
    ]));
    const fixture = render(), view = fixture.componentInstance;
    expect(view.recentPecs.map(pec => pec.id)).toEqual(['p5', 'p4', 'p3', 'p2', 'p1']);
    expect(fixture.nativeElement.querySelector('.activity-list a').getAttribute('href')).toBe('/recce/p5');
    expect(fixture.nativeElement.textContent).toContain('Rali real'); expect(fixture.nativeElement.textContent).not.toContain('Invalid');
  });
  it('distinguishes loading/error from empty, supports retry and cancels reads on destroy', () => {
    const pending = new Subject<never>(); rallies.getRallies.and.returnValue(pending);
    const fixture = render(), view = fixture.componentInstance; expect(view.activityState).toBe('loading');
    pending.error(new Error('unavailable')); fixture.detectChanges(); expect(view.activityState).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar');
    rallies.getRallies.and.returnValue(of([]));
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('Tentar novamente'))!.click();
    expect(view.activityState).toBe('ready');
    const next = new Subject<never>(); rallies.getRallies.and.returnValue(next); view.loadActivity(); expect(next.observed).toBeTrue();
    fixture.destroy(); expect(next.observed).toBeFalse();
  });
  it('requires confirmation before deleting a car and preserves the car when cancelled', async () => {
    const fixture = render(); confirm.confirm.and.resolveTo(false);
    await fixture.componentInstance.deleteCar({ id: 'a', name: 'Carro', carClass: 'Rally2', active: true });
    expect(confirm.confirm).toHaveBeenCalled(); expect(api.deleteCar).not.toHaveBeenCalled();
  });
});
