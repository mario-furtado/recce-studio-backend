import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
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
  it('submits the full form, confirms a request-bound code and clears the password', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = open('register'), view = fixture.componentInstance;
    const oldToken = localStorage.getItem('recce_auth_token');
    view.email = 'new@example.invalid'; view.displayName = 'Nova conta'; view.dateOfBirth = '1992-02-29';
    view.password = view.repeatPassword = 'registration-password'; view.submit();
    const request = http.expectOne(`${API_BASE_URL}/api/auth/register`);
    expect(request.request.body).toEqual({ email: view.email, displayName: view.displayName, dateOfBirth: view.dateOfBirth, password: view.password });
    expect(view.busy).toBeTrue(); view.submit(); http.expectNone(r => r.method === 'POST');
    request.flush({ requestId: proof, remainingSeconds: 300 }, { status: 202, statusText: 'Accepted' }); fixture.detectChanges();
    expect(view.password).toBe(''); expect(view.title).toBe('Verifica o teu email');
    expect(fixture.nativeElement.textContent).toContain(view.email);
    expect(fixture.nativeElement.querySelector('[role="timer"]').textContent).toBe('5:00');
    view.code = '012345'; view.confirmRegistration();
    const confirmation = http.expectOne(`${API_BASE_URL}/api/auth/registration/confirm`);
    expect(confirmation.request.body).toEqual({ requestId: proof, code: '012345' });
    expect(navigate).not.toHaveBeenCalled();
    confirmation.flush(null, { status: 204, statusText: 'No Content' });
    expect(navigate).toHaveBeenCalledOnceWith(['/login'], { replaceUrl: true, info: 'account-verified' });
    expect(localStorage.getItem('recce_auth_token')).toBe(oldToken); fixture.destroy();
  });
  it('keeps the pending data available for resend and email correction after expiry', fakeAsync(() => {
    const fixture = open('register'), view = fixture.componentInstance;
    view.email = 'typo@example.invalid'; view.displayName = 'Nova conta'; view.dateOfBirth = '1992-02-29';
    view.password = view.repeatPassword = 'registration-password'; view.submit();
    http.expectOne(`${API_BASE_URL}/api/auth/register`).flush({ requestId: proof, remainingSeconds: 1 });
    tick(1000);
    expect(view.secondsRemaining).toBe(0);
    view.code = '012345'; view.confirmRegistration(); http.expectNone(r => r.method === 'POST');
    view.resendRegistration();
    const resend = http.expectOne(`${API_BASE_URL}/api/auth/registration/resend`);
    expect(resend.request.body).toEqual({ requestId: proof });
    resend.flush({ requestId: proof, remainingSeconds: 300 });
    expect(view.secondsRemaining).toBe(300); expect(view.code).toBe('');
    view.startEmailCorrection(); view.resendRegistration('fixed@example.invalid');
    const correction = http.expectOne(`${API_BASE_URL}/api/auth/registration/resend`);
    expect(correction.request.body).toEqual({ requestId: proof, email: 'fixed@example.invalid' });
    correction.flush({ requestId: proof, remainingSeconds: 300 });
    expect(view.email).toBe('fixed@example.invalid'); expect(view.editingEmail).toBeFalse();
    fixture.destroy();
  }));
  it('keeps disabled configuration closed and permits availability retry', () => {
    const fixture = open('register', false), view = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const email = root.querySelector<HTMLInputElement>('input[name="email"]')!;
    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(email.matches(':disabled')).toBeTrue(); expect(submit.disabled).toBeTrue();
    expect(root.textContent).toContain('O envio de códigos de verificação ainda não está disponível');
    view.submit(); http.expectNone(r => r.method === 'POST');
    view.load(); http.expectOne(`${API_BASE_URL}/api/auth/account-options`).flush(null, { status: 503, statusText: 'Unavailable' }); fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível contactar');
    view.load(); http.expectOne(`${API_BASE_URL}/api/auth/account-options`).flush({ available: true }); fixture.detectChanges();
    expect(email.matches(':disabled')).toBeFalse(); expect(submit.disabled).toBeFalse();
    expect(root.querySelector('[role="alert"]')).toBeNull(); fixture.destroy();
  });
  it('removes the proof from the address, validates bounds and submits proof only in the body', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    history.replaceState(history.state, '', `${location.pathname}#token=${proof}`);
    const fixture = open('verify'), view = fixture.componentInstance;
    expect(location.hash).toBe(''); expect(view.token).toBe(proof);
    view.displayName = 'Érica de Ensaio'; view.dateOfBirth = '1992-02-29';
    view.password = 'short'; view.repeatPassword = 'short'; view.submit(); http.expectNone(r => r.method === 'POST');
    view.password = 'é'.repeat(128); view.repeatPassword = view.password; view.submit();
    const request = http.expectOne(`${API_BASE_URL}/api/auth/verify-email`);
    expect(request.request.body).toEqual({ token: proof, password: view.password, displayName: 'Érica de Ensaio', dateOfBirth: '1992-02-29' });
    expect(request.request.url).not.toContain(proof);
    request.flush(null, { status: 204, statusText: 'No Content' }); fixture.detectChanges();
    expect(view.completed).toBeTrue(); expect(view.token).toBe(''); expect(view.password).toBe('');
    expect(navigate).toHaveBeenCalledOnceWith(['/login'], { replaceUrl: true, info: 'account-verified' }); fixture.destroy();
  });
  it('preserves recovery form on rate/network failure and never confirms success early', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = open('reset'), view = fixture.componentInstance; view.password = 'replacement-password'; view.repeatPassword = view.password; view.submit();
    http.expectOne(`${API_BASE_URL}/api/auth/password-reset/confirm`).flush({ message: 'Demasiados pedidos.' }, { status: 429, statusText: 'Too Many Requests' });
    expect(view.completed).toBeFalse(); expect(view.token).toBe(proof); expect(view.error).toContain('Demasiados');
    expect(navigate).not.toHaveBeenCalled();
    view.submit(); http.expectOne(`${API_BASE_URL}/api/auth/password-reset/confirm`).flush(null, { status: 204, statusText: 'No Content' });
    expect(view.completed).toBeTrue(); expect(view.password).toBe('');
    expect(navigate).toHaveBeenCalledOnceWith(['/login'], { replaceUrl: true, info: 'password-reset' }); fixture.destroy();
  });
  it('loads only its own identity and displays an honest no-workspace state', () => {
    const fixture = TestBed.createComponent(PersonalAccountComponent); fixture.detectChanges();
    http.expectOne(`${API_BASE_URL}/api/auth/me`).flush({ email: 'new@example.invalid', emailVerified: true, hasWorkspace: false }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ainda não tens uma tripulação'); expect(fixture.nativeElement.querySelector('a[href="/pecs"]')).toBeNull();
    http.expectNone(r => /team-profile|rallies/.test(r.url)); fixture.destroy();
  });
});
