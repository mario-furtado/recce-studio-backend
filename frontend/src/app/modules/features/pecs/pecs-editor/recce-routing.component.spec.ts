import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../../app.routes';
import { PecsEditorComponent } from './pecs-editor.component';
import { PecDetailComponent } from '../pec-detail/pec-detail.component';
import { PecService } from '../../../core/services/pecs.service';
import { OfflineRecceStoreService } from '../../../core/services/offline-recce-store.service';
import { SharedProperties } from '../../../core/shared/shared-properties';
import { ConfirmDialogService } from '../../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { defaultNotebook } from '../../../core/notebook/notebook.model';

@Component({ standalone: true, template: 'Escolher rali e PEC' })
class SelectionComponent {}

describe('AUD-ROUTE-001 explicit recce targets', () => {
  let http: HttpTestingController;
  let localValues: Map<string, string | null>;

  beforeEach(() => {
    localValues = new Map(['recce_timestamps_pec-1', 'recce_session_id_pec-1']
      .map((key) => [key, localStorage.getItem(key)]));
    const children = routes.find((route) => route.children)!.children!;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      provideRouter([children.find((route) => route.path === 'new-recce')!,
        children.find((route) => route.path === 'recce/:id')!,
        { path: 'pecs', component: SelectionComponent }]),
      { provide: OfflineRecceStoreService, useValue: { getSession: () => Promise.resolve(null) } },
      { provide: SharedProperties, useValue: { error: jasmine.createSpy('error'), info: jasmine.createSpy('info') } },
      { provide: ConfirmDialogService, useValue: {} },
    ] });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    http.verify();
    localValues.forEach((value, key) => {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    });
  });

  function drainInitialReads(): void {
    const requests = http.match(() => true);
    expect(requests.length).toBe(0);
    expect(requests.some((request) => request.request.url.includes('pec-1'))).toBeFalse();
    // Keep the failing-before run clean while retaining all assertions.
    requests.forEach((request) => request.flush(request.request.url.endsWith('/assets')
      ? { hasVideo: false, hasAudio: false, hasGps: false } : []));
    http.match(() => true).forEach((request) => request.flush([]));
  }

  it('opens the production new-recce route without reading or syncing an existing PEC', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/new-recce');
    drainInitialReads();
    expect(harness.routeNativeElement!.querySelector('a[href="/pecs"]')).not.toBeNull();
  });

  it('does not invent a PEC when the editor has neither an input nor a route id', () => {
    const editor = new PecsEditorComponent({ snapshot: { paramMap: convertToParamMap({}) } } as ActivatedRoute,
      TestBed.inject(PecService), TestBed.inject(OfflineRecceStoreService),
      TestBed.inject(SharedProperties), TestBed.inject(ConfirmDialogService));
    editor.ngOnInit();
    expect(editor.pecId).toBe('');
    drainInitialReads();
    editor.ngOnDestroy();
  });

  it('provides recovery instead of an editable PEC after an invalid route target returns 404', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/recce/missing-pec', PecDetailComponent);
    http.expectOne((request) => request.url.endsWith('/api/pecs/missing-pec'))
      .flush({}, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('PEC indisponível');
    expect(harness.routeNativeElement!.querySelector('a[href="/new-recce"]')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('app-pecs-editor')).toBeNull();
  });

  it('does not read or synchronize a legacy pec-1 cache on the new-recce route', async () => {
    localStorage.setItem('recce_timestamps_pec-1', JSON.stringify([{ timestamp: 1, text: 'old recording' }]));
    localStorage.setItem('recce_session_id_pec-1', 'old-session');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/new-recce');
    expect(localStorage.getItem('recce_session_id_pec-1')).toBe('old-session');
    expect(harness.routeNativeElement!.querySelector('a[href="/recce-mode"]')).not.toBeNull();
    http.expectNone(() => true);
  });

  it('offers an explicit route to the existing rally/PEC creation and selection flow', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/new-recce');
    const link = harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a[href="/pecs"]')!;
    expect(link.textContent).toContain('Escolher ou criar');
    await harness.navigateByUrl(link.pathname, SelectionComponent);
    expect(harness.routeNativeElement!.textContent).toContain('Escolher rali e PEC');
    http.expectNone(() => true);
  });

  it('renders a recovery link and locks editor actions for a whitespace-only input target', () => {
    const fixture = TestBed.createComponent(PecsEditorComponent);
    fixture.componentInstance.pecId = '   ';
    fixture.detectChanges();
    expect(fixture.componentInstance.pecId).toBe('');
    expect(fixture.componentInstance.isLocked).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Seleciona uma PEC');
    expect(fixture.nativeElement.querySelector('a[href="/new-recce"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
    http.expectNone(() => true);
    fixture.destroy();
  });

  it('handles missing detail ids without loading or mutating a PEC', () => {
    const fixture = TestBed.createComponent(PecDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.setMode('STUDIO');
    fixture.componentInstance.updateStatus('COMPLETED');
    fixture.componentInstance.savePecDetails();
    expect(fixture.nativeElement.textContent).toContain('PEC indisponível');
    expect(fixture.nativeElement.querySelector('app-pecs-editor')).toBeNull();
    http.expectNone(() => true);
    fixture.destroy();
  });

  for (const status of [403, 500]) {
    it(`keeps the editor closed and provides recovery after HTTP ${status}`, async () => {
      const harness = await RouterTestingHarness.create();
      const detail = await harness.navigateByUrl('/recce/unavailable', PecDetailComponent);
      http.expectOne((request) => request.url.endsWith('/api/pecs/unavailable'))
        .flush({}, { status, statusText: 'Unavailable' });
      detail.setMode('STUDIO');
      detail.updateStatus('COMPLETED');
      detail.savePecDetails();
      harness.detectChanges();
      expect(harness.routeNativeElement!.textContent).toContain('PEC indisponível');
      expect(harness.routeNativeElement!.querySelector('app-pecs-editor')).toBeNull();
      http.expectNone(() => true);
      await harness.navigateByUrl('/new-recce');
      expect(harness.routeNativeElement!.textContent).toContain('Novo reconhecimento');
      http.expectNone(() => true);
    });
  }

  it('does not open the editor until the API confirms the explicitly chosen PEC', async () => {
    const harness = await RouterTestingHarness.create();
    const detail = await harness.navigateByUrl('/recce/chosen-pec', PecDetailComponent);
    expect(harness.routeNativeElement!.textContent).toContain('A carregar PEC');
    detail.setMode('STUDIO');
    detail.updateStatus('COMPLETED');
    detail.savePecDetails();
    http.expectNone((request) => request.method !== 'GET');
    http.expectOne((request) => request.url.endsWith('/api/pecs/chosen-pec'))
      .flush({ id: 'chosen-pec', name: 'Chosen', status: 'DRAFT', number: 1, distanceKm: 1 });
    detail.setMode('STUDIO');
    harness.detectChanges();
    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/api/notebook-preferences'))
      .flush(defaultNotebook());
    const initial = http.match(() => true);
    expect(initial.length).toBeGreaterThan(0);
    expect(initial.every((request) => request.request.url.includes('/api/pecs/chosen-pec/'))).toBeTrue();
    initial.forEach((request) => request.flush(request.request.url.endsWith('/assets')
      ? { hasVideo: false, hasAudio: false, hasGps: false } : []));
    const followUp = http.match(() => true);
    expect(followUp.every((request) => request.request.url.includes('/api/pecs/chosen-pec/'))).toBeTrue();
    followUp.forEach((request) => request.flush([]));
    expect(harness.routeNativeElement!.querySelector('app-pecs-editor')).not.toBeNull();
    http.expectNone((request) => request.method !== 'GET' || request.url.includes('pec-1'));
  });

  it('does not substitute another PEC returned by an inconsistent response', async () => {
    const harness = await RouterTestingHarness.create();
    const detail = await harness.navigateByUrl('/recce/chosen-pec', PecDetailComponent);
    http.expectOne((request) => request.url.endsWith('/api/pecs/chosen-pec'))
      .flush({ id: 'pec-1', name: 'Wrong target', status: 'DRAFT' });
    detail.setMode('STUDIO');
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('PEC indisponível');
    expect(harness.routeNativeElement!.querySelector('app-pecs-editor')).toBeNull();
    http.expectNone(() => true);
  });
});
