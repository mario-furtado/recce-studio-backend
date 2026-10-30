import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PecsListComponent } from './pecs-list/pecs-list.component';
import { RallyDetailComponent } from './rally-detail/rally-detail.component';
import { Rally, Pec } from '../../core/models/rally';
import { API_BASE_URL } from '../../core/services/api.config';
import { SharedProperties } from '../../core/shared/shared-properties';
import { ConfirmDialogService } from '../../core/shared/components/confirm-dialog/confirm-dialog.service';

const rally: Rally = { id: 'r1', name: 'Serra', year: 2026, surface: 'TERRA', location: 'Covilhã', icon: 'RS', status: 'DRAFT', carId: 'c1', carClass: 'Rally2', pecsCount: 2 };
const pec: Pec = { id: 'p1', number: 1, name: 'Penhas', distanceKm: 8.5, totalNotes: 12, status: 'DRAFT', updatedAt: '2026-10-29' };

describe('FEAT-016 rally management', () => {
  let http: HttpTestingController;
  let confirm: jasmine.SpyObj<ConfirmDialogService>;
  beforeEach(() => {
    confirm = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);
    TestBed.configureTestingModule({ imports: [PecsListComponent, RallyDetailComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ConfirmDialogService, useValue: confirm },
      { provide: SharedProperties, useValue: { connectionMode$: new BehaviorSubject('online'), error: jasmine.createSpy('error'), success: jasmine.createSpy('success'), info: jasmine.createSpy('info') } }] });
    http = TestBed.inject(HttpTestingController);
    spyOn(PecsListComponent.prototype, 'ngOnInit').and.stub(); spyOn(RallyDetailComponent.prototype, 'ngOnInit').and.stub();
  });
  afterEach(() => http.verify());
  function list() { const fixture = TestBed.createComponent(PecsListComponent); fixture.componentInstance.rallies = [rally]; fixture.detectChanges(); return fixture; }
  function detail() { const fixture = TestBed.createComponent(RallyDetailComponent); fixture.componentInstance.rally = { ...rally, pecs: [{ ...pec }] }; fixture.componentInstance.rallyId = rally.id; fixture.detectChanges(); return fixture; }
  it('preserves every filter, keeps advanced values when collapsed, and resets to active rallies', () => {
    const fixture = list(), view = fixture.componentInstance;
    view.rallies = [rally, { ...rally, id: 'r2', year: 2025, status: 'COMPLETED' }];
    view.searchTerm = 'COV'; view.surfaceFilter = 'TERRA'; view.yearFilter = '2026'; view.carFilter = 'c1'; view.classFilter = 'Rally2';
    expect(view.filteredRallies.map(item => item.id)).toEqual(['r1']); view.toggleFilters(); view.toggleFilters(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#rallyFilters').hidden).toBeTrue(); expect(view.yearFilter).toBe('2026');
    view.clearFilters(); expect(view.statusFilter).toBe('ACTIVE'); expect(view.searchTerm).toBe(''); expect(view.activeFiltersCount).toBe(0);
    view.statusFilter = 'COMPLETED'; expect(view.filteredRallies.map(item => item.id)).toEqual(['r2']);
  });
  it('distinguishes loading/error/empty/no matches and recovers through retry', () => {
    const fixture = list(), view = fixture.componentInstance; view.loadRalliesFromApi(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('A carregar ralis');
    http.expectOne(`${API_BASE_URL}/api/rallies`).flush('failed', { status: 500, statusText: 'error' }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar'); expect(fixture.nativeElement.textContent).not.toContain('Ainda não tens ralis');
    view.loadRalliesFromApi(); http.expectOne(`${API_BASE_URL}/api/rallies`).flush([]); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Ainda não tens ralis');
    view.rallies = [rally]; view.searchTerm = 'missing'; fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Nenhum rali corresponde');
  });
  it('never navigates when editing or cancelling rally deletion; explicit access keeps its destination', async () => {
    const fixture = list(), view = fixture.componentInstance, navigate = spyOn(TestBed.inject(Router), 'navigate');
    fixture.nativeElement.querySelector('button[aria-label="Editar Serra"]').click(); expect(view.editingRallyId).toBe('r1'); expect(navigate).not.toHaveBeenCalled();
    confirm.confirm.and.resolveTo(false); await view.deleteRally('r1', 'Serra', new Event('click')); http.expectNone(request => request.method === 'DELETE');
    view.viewRallyDetails('r1'); expect(navigate).toHaveBeenCalledOnceWith(['/rally', 'r1']);
  });
  it('hides results during editing and restores the filtered list and trigger focus after cancel/save', async () => {
    const fixture = list(), view = fixture.componentInstance;
    view.searchTerm = 'Serra'; fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('button[aria-label="Editar Serra"]') as HTMLButtonElement;
    trigger.focus(); trigger.click(); fixture.detectChanges();
    const results = fixture.nativeElement.querySelector('.management-list').parentElement as HTMLElement;
    expect(results.hidden).toBeTrue(); expect(view.rallies).toEqual([rally]);
    view.cancelForm(); fixture.detectChanges(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(results.hidden).toBeFalse(); expect(document.activeElement).toBe(trigger); expect(view.searchTerm).toBe('Serra');
    trigger.click(); fixture.detectChanges(); view.saveRally();
    http.expectOne(`${API_BASE_URL}/api/rallies/r1`).flush('failed', { status: 500, statusText: 'error' }); fixture.detectChanges();
    expect(view.isCreatingRally).toBeTrue(); expect(results.hidden).toBeTrue();
    view.saveRally(); http.expectOne(`${API_BASE_URL}/api/rallies/r1`).flush({ ...rally, location: 'Guarda' }); fixture.detectChanges();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(results.hidden).toBeFalse(); expect(document.activeElement).toBe(trigger); expect(view.rallies[0].location).toBe('Guarda');
  });
  it('keeps offline reads/actions restricted and redirects to offline sessions', () => {
    const fixture = list(), view = fixture.componentInstance, shared = TestBed.inject(SharedProperties);
    const navigate = spyOn(TestBed.inject(Router), 'navigate'); shared.connectionMode$.next('offline'); view.loadRalliesFromApi(); view.openCreateRallyForm();
    http.expectNone(() => true); expect(view.rallies).toEqual([]); expect(navigate).toHaveBeenCalledWith(['/offline-recces']);
  });
  it('uses three real metrics, one creation action and all PEC states without card navigation', () => {
    const fixture = detail(), view = fixture.componentInstance;
    view.rally.pecs.push({ ...pec, id: 'p2', totalNotes: 3, distanceKm: 2, status: 'PENDING_VIDEO' }); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(view.totalDistance).toBe(10.5); expect(view.totalNotes).toBe(15); expect(root.querySelectorAll('.management-metrics dd').length).toBe(3);
    expect(root.querySelectorAll('.metric-tile').length).toBe(0);
    expect(root.textContent).toContain('Aguarda vídeo');
    expect(Array.from(root.querySelectorAll('button')).filter(button => button.textContent?.trim() === 'Adicionar Nova PEC').length).toBe(1);
    root.querySelector<HTMLElement>('article h3')!.click(); expect(TestBed.inject(Router).url).toBe('/');
  });
  it('requires confirmation before completion and preserves reopen/readonly contracts', async () => {
    const fixture = detail(), view = fixture.componentInstance; confirm.confirm.and.resolveTo(false); await view.confirmFinishRally(); http.expectNone(request => request.method === 'PUT');
    confirm.confirm.and.resolveTo(true); await view.confirmFinishRally(); const request = http.expectOne(`${API_BASE_URL}/api/rallies/r1`);
    expect(request.request.body).toEqual({ status: 'COMPLETED' }); request.flush({ ...rally, status: 'COMPLETED' }); fixture.detectChanges();
    expect(view.isCompleted).toBeTrue(); expect(fixture.nativeElement.querySelector('button.accent-button').disabled).toBeTrue();
    view.openCreateModal(); expect(view.showCreateModal).toBeFalse(); view.updateRallyStatus('DRAFT'); http.expectOne(`${API_BASE_URL}/api/rallies/r1`).flush(rally); expect(view.isCompleted).toBeFalse();
  });
  it('preserves PEC edit validation and keeps a completed PEC readonly', () => {
    const fixture = detail(), view = fixture.componentInstance; view.startEditPec(pec, new Event('click')); view.pecDraft.name = ' '; view.saveEditedPec(pec, new Event('click'));
    http.expectNone(request => request.method === 'PATCH'); expect(view.editingPecId).toBe('p1'); view.pecDraft.name = 'Penhas 2'; view.saveEditedPec(pec, new Event('click'));
    const request = http.expectOne(`${API_BASE_URL}/api/pecs/p1`); expect(request.request.body.name).toBe('Penhas 2'); request.flush({ ...pec, name: 'Penhas 2' }); expect(view.editingPecId).toBeNull();
    view.startEditPec({ ...pec, status: 'COMPLETED' }, new Event('click')); expect(view.editingPecId).toBeNull();
  });
  it('keeps loading until PECs arrive and reports failures without invented metrics', () => {
    const fixture = detail(), view = fixture.componentInstance; view.getRally(); http.expectOne(`${API_BASE_URL}/api/rallies/r1`).flush(rally); expect(view.isLoading).toBeTrue();
    http.expectOne(`${API_BASE_URL}/api/rallies/r1/pecs`).flush('failed', { status: 500, statusText: 'error' }); fixture.detectChanges(); expect(view.loadError).toBe('pecs'); expect(fixture.nativeElement.querySelector('.management-metrics')).toBeNull();
    view.getRally(); http.expectOne(`${API_BASE_URL}/api/rallies/r1`).flush(rally); http.expectOne(`${API_BASE_URL}/api/rallies/r1/pecs`).flush([]); fixture.detectChanges(); expect(view.isLoading).toBeFalse(); expect(fixture.nativeElement.textContent).toContain('Este rali ainda não tem PECs');
  });
});
