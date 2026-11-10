import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AccountAccessComponent } from './account-access.component';
import { PersonalAccountComponent } from './personal-account.component';
import { API_BASE_URL } from '../../services/api.config';

describe('FEAT-018 account access flows', () => {
  let http: HttpTestingController;
  let page = 'register';
  const proof = 'ab'.repeat(32);
  let previousUrl: string;
  beforeEach(() => {
    previousUrl = location.href;
    TestBed.configureTestingModule({ imports: [AccountAccessComponent, PersonalAccountComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { data: { get page() { return page; } }, fragment: `token=${proof}` } } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); history.replaceState(history.state, '', previousUrl); });
  function open(kind: string, available = true) {
    page = kind; const fixture = TestBed.createComponent(AccountAccessComponent); fixture.detectChanges();
    http.expectOne(`${API_BASE_URL}/api/auth/account-options`).flush({ available }); fixture.detectChanges(); return fixture;
  }
  it('requests email only without storing or logging a registration session', () => {
    const fixture = open('register'), view = fixture.componentInstance;
    const oldToken = localStorage.getItem('recce_auth_token'); view.email = 'new@example.invalid'; view.submit();
    const request = http.expectOne(`${API_BASE_URL}/api/auth/register`); expect(request.request.body).toEqual({ email: view.email });
    expect(view.busy).toBeTrue(); view.submit(); http.expectNone(r => r.method === 'POST');
    request.flush({ message: 'Se aplicável, receberás instruções.' }, { status: 202, statusText: 'Accepted' }); fixture.detectChanges();
    expect(view.message).toContain('Se aplicável'); expect(localStorage.getItem('recce_auth_token')).toBe(oldToken); fixture.destroy();
  });
  it('keeps disabled configuration closed and permits availability retry', () => {
    const fixture = open('register', false), view = fixture.componentInstance;
    view.submit(); http.expectNone(r => r.method === 'POST'); expect(fixture.nativeElement.querySelector('form')).toBeNull();
    view.load(); http.expectOne(`${API_BASE_URL}/api/auth/account-options`).flush({ available: true }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull(); fixture.destroy();
  });
  it('removes the proof from the address, validates bounds and submits proof only in the body', () => {
    history.replaceState(history.state, '', `${location.pathname}#token=${proof}`);
    const fixture = open('verify'), view = fixture.componentInstance;
    expect(location.hash).toBe(''); expect(view.token).toBe(proof);
    view.password = 'short'; view.repeatPassword = 'short'; view.submit(); http.expectNone(r => r.method === 'POST');
    view.password = 'é'.repeat(128); view.repeatPassword = view.password; view.submit();
    const request = http.expectOne(`${API_BASE_URL}/api/auth/verify-email`); expect(request.request.body.token).toBe(proof); expect(request.request.url).not.toContain(proof);
    request.flush(null, { status: 204, statusText: 'No Content' }); fixture.detectChanges();
    expect(view.completed).toBeTrue(); expect(view.token).toBe(''); expect(view.password).toBe(''); expect(view.message).toContain('Já podes iniciar sessão'); fixture.destroy();
  });
  it('preserves recovery form on rate/network failure and never confirms success early', () => {
    const fixture = open('reset'), view = fixture.componentInstance; view.password = 'replacement-password'; view.repeatPassword = view.password; view.submit();
    http.expectOne(`${API_BASE_URL}/api/auth/password-reset/confirm`).flush({ message: 'Demasiados pedidos.' }, { status: 429, statusText: 'Too Many Requests' });
    expect(view.completed).toBeFalse(); expect(view.token).toBe(proof); expect(view.error).toContain('Demasiados');
    view.submit(); http.expectOne(`${API_BASE_URL}/api/auth/password-reset/confirm`).flush(null, { status: 204, statusText: 'No Content' });
    expect(view.completed).toBeTrue(); expect(view.password).toBe(''); fixture.destroy();
  });
  it('loads only its own identity and displays an honest no-workspace state', () => {
    const fixture = TestBed.createComponent(PersonalAccountComponent); fixture.detectChanges();
    http.expectOne(`${API_BASE_URL}/api/auth/me`).flush({ email: 'new@example.invalid', emailVerified: true, hasWorkspace: false }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ainda não tens uma tripulação'); expect(fixture.nativeElement.querySelector('a[href="/pecs"]')).toBeNull();
    http.expectNone(r => /team-profile|rallies/.test(r.url)); fixture.destroy();
  });
});
