import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CrewManagerComponent } from './crew-manager.component';
import { API_BASE_URL } from '../../services/api.config';

describe('FEAT-019 crew manager', () => {
  let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ imports: [CrewManagerComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  function open() { const fixture = TestBed.createComponent(CrewManagerComponent); fixture.detectChanges(); return fixture; }
  it('shows a real empty state and creates without sending owner or context fields', () => {
    const fixture = open(); http.expectOne(`${API_BASE_URL}/api/crews`).flush([]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('primeira tripulação');
    const view = fixture.componentInstance; view.name = 'Crew A'; view.create(); view.create();
    const request = http.expectOne(`${API_BASE_URL}/api/crews`); expect(request.request.body).toEqual({ name: 'Crew A' }); expect(request.request.headers.get('Idempotency-Key')!.length).toBeGreaterThan(15);
    request.flush({ id: 'crew-a', name: 'Crew A', role: 'OWNER' }); fixture.detectChanges(); expect(view.crews.length).toBe(1); expect(view.name).toBe(''); fixture.destroy();
  });
  it('reuses the same idempotency key after an uncertain response and avoids duplicate rows', () => {
    const fixture = open(); http.expectOne(`${API_BASE_URL}/api/crews`).flush([]);
    const view = fixture.componentInstance; view.name = 'Crew A'; view.create(); let request = http.expectOne(`${API_BASE_URL}/api/crews`); const key = request.request.headers.get('Idempotency-Key');
    request.flush({ message: 'Tenta novamente.' }, { status: 503, statusText: 'Unavailable' }); expect(view.name).toBe('Crew A'); expect(view.busy).toBeFalse();
    view.name = '  Crew A '; view.create(); request = http.expectOne(`${API_BASE_URL}/api/crews`); expect(request.request.headers.get('Idempotency-Key')).toBe(key); expect(request.request.body).toEqual({ name: 'Crew A' });
    request.flush({ id: 'crew-a', name: 'Crew A' }); expect(view.crews.length).toBe(1); fixture.destroy();
  });
  it('does not confuse loading failure with an empty list and permits retry', () => {
    const fixture = open(); http.expectOne(`${API_BASE_URL}/api/crews`).flush(null, { status: 500, statusText: 'Failure' }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('primeira tripulação'); expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    fixture.componentInstance.load(); http.expectOne(`${API_BASE_URL}/api/crews`).flush([{ id: 'crew-b', name: 'B' }]); fixture.detectChanges();
    expect(fixture.componentInstance.loadFailed).toBeFalse(); expect(fixture.nativeElement.textContent).toContain('B'); fixture.destroy();
  });
  it('prevents creation racing an older list response or a failed list load', () => {
    const fixture = open(), view = fixture.componentInstance; view.name = 'Pending'; view.create();
    http.expectNone(r => r.method === 'POST');
    http.expectOne(`${API_BASE_URL}/api/crews`).flush(null, { status: 503, statusText: 'Unavailable' }); view.create(); http.expectNone(r => r.method === 'POST');
    view.load(); http.expectOne(`${API_BASE_URL}/api/crews`).flush([]); view.create();
    http.expectOne(`${API_BASE_URL}/api/crews`).flush({ id: 'crew', name: 'Pending' }); expect(view.crews.length).toBe(1); fixture.destroy();
  });
  it('discards late results and prevents an old form creating a crew after the login changes', () => {
    const token = localStorage.getItem('recce_auth_token');
    const fixture = open(), view = fixture.componentInstance;
    try {
      localStorage.setItem('recce_auth_token', 'another-session');
      http.expectOne(`${API_BASE_URL}/api/crews`).flush([{ id: 'old', name: 'Old account' }]);
      expect(view.crews).toEqual([]); expect(view.error).toContain('A sessão mudou');
      view.name = 'Old form'; view.create(); http.expectNone(r => r.method === 'POST');
    } finally { if (token === null) localStorage.removeItem('recce_auth_token'); else localStorage.setItem('recce_auth_token', token); fixture.destroy(); }
  });
});
