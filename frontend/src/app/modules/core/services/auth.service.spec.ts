import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { SharedProperties } from '../shared/shared-properties';
import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';

describe('AUD-SEC-006 server logout lifecycle', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let previousToken: string | null;
  let previousEmail: string | null;
  let navigate: jasmine.Spy;
  let error: jasmine.Spy;

  beforeEach(() => {
    previousToken = localStorage.getItem('recce_auth_token');
    previousEmail = localStorage.getItem('recce_auth_email');
    localStorage.setItem('recce_auth_token', 'active-token');
    localStorage.setItem('recce_auth_email', 'driver@example.test');
    navigate = jasmine.createSpy('navigate');
    error = jasmine.createSpy('error');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
        { provide: SharedProperties, useValue: { error } },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    if (previousToken === null) localStorage.removeItem('recce_auth_token');
    else localStorage.setItem('recce_auth_token', previousToken);
    if (previousEmail === null) localStorage.removeItem('recce_auth_email');
    else localStorage.setItem('recce_auth_email', previousEmail);
  });

  it('revokes the active bearer before clearing the local session', () => {
    auth.logout();
    const request = http.expectOne(`${API_BASE_URL}/api/auth/logout`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer active-token');
    expect(auth.getToken()).toBe('active-token');
    expect(navigate).not.toHaveBeenCalled();
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(auth.getToken()).toBeNull();
    expect(auth.getEmail()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('reports a network failure and permits a retry without pretending revocation succeeded', () => {
    auth.logout();
    http.expectOne(`${API_BASE_URL}/api/auth/logout`).error(new ProgressEvent('error'));
    expect(auth.getToken()).toBe('active-token');
    expect(auth.getEmail()).toBe('driver@example.test');
    expect(navigate).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    auth.logout();
    http.expectOne(`${API_BASE_URL}/api/auth/logout`).flush(null, { status: 204, statusText: 'No Content' });
    expect(auth.getToken()).toBeNull();
  });

  it('retains the session on server failure', () => {
    auth.logout();
    http.expectOne(`${API_BASE_URL}/api/auth/logout`).flush(null, { status: 500, statusText: 'Server Error' });
    expect(auth.getToken()).toBe('active-token');
    expect(error).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not clear a newer login when an earlier logout completes', () => {
    auth.logout();
    const request = http.expectOne(`${API_BASE_URL}/api/auth/logout`);
    localStorage.setItem('recce_auth_token', 'new-token');
    localStorage.setItem('recce_auth_email', 'new@example.test');
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(auth.getToken()).toBe('new-token');
    expect(auth.getEmail()).toBe('new@example.test');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not report an old logout failure against a newer session', () => {
    auth.logout();
    const request = http.expectOne(`${API_BASE_URL}/api/auth/logout`);
    localStorage.setItem('recce_auth_token', 'new-token');
    request.error(new ProgressEvent('error'));
    expect(auth.getToken()).toBe('new-token');
    expect(error).not.toHaveBeenCalled();
  });

  it('ends an offline-only session locally without sending its sentinel', () => {
    auth.enterOffline();
    auth.logout();
    http.expectNone(`${API_BASE_URL}/api/auth/logout`);
    expect(auth.getToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('handles an absent session without a server request', () => {
    auth.clearSession();
    auth.logout();
    http.expectNone(`${API_BASE_URL}/api/auth/logout`);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('times out an unresponsive logout and preserves retry credentials', fakeAsync(() => {
    auth.logout();
    const request = http.expectOne(`${API_BASE_URL}/api/auth/logout`);
    tick(10001);
    expect(request.cancelled).toBeTrue();
    expect(auth.getToken()).toBe('active-token');
    expect(error).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  }));
});
