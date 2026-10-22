import { HttpRequest, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '../services/api.config';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('AUD-SEC-004 API bearer destination', () => {
  let previousToken: string | null;

  beforeEach(() => {
    previousToken = localStorage.getItem('recce_auth_token');
    localStorage.setItem('recce_auth_token', 'audit-secret-token');
  });

  afterEach(() => {
    if (previousToken === null) localStorage.removeItem('recce_auth_token');
    else localStorage.setItem('recce_auth_token', previousToken);
  });

  function forwarded(url: string): HttpRequest<unknown> {
    let result: HttpRequest<unknown> | undefined;
    authInterceptor(new HttpRequest('GET', url), (request) => {
      result = request;
      return of(new HttpResponse({ status: 200 }));
    }).subscribe();
    if (!result) throw new Error('Interceptor did not forward the request');
    return result;
  }

  for (const url of [
    'https://third-party.invalid/telemetry',
    '//third-party.invalid/api/rallies',
    'https://third-party.invalid/api/rallies',
    '/assets/env.js',
    '/api-other/rallies',
    '/api/../telemetry',
    'data:text/plain,/api/rallies',
    'http://[invalid/api/rallies',
  ]) {
    it(`does not disclose the bearer token to ${url}`, () => {
      expect(forwarded(url).headers.has('Authorization')).toBeFalse();
    });
  }

  for (const url of ['/api/rallies', 'api/rallies', `${API_BASE_URL}/api/rallies`]) {
    it(`authenticates trusted API request ${url}`, () => {
      expect(forwarded(url).headers.get('Authorization')).toBe('Bearer audit-secret-token');
    });
  }

  for (const path of ['/api/auth/login', '/api/auth/register', '/api/auth/login/?next=home']) {
    it(`keeps public authentication request ${path} free of stored bearer tokens`, () => {
      expect(forwarded(`${API_BASE_URL}${path}`).headers.has('Authorization')).toBeFalse();
    });
  }

  it('does not use query strings to decide whether authentication is public', () => {
    expect(forwarded(`${API_BASE_URL}/api/rallies?next=/api/auth/login`).headers.get('Authorization'))
      .toBe('Bearer audit-secret-token');
    expect(forwarded(`${API_BASE_URL}/api/auth/login-history`).headers.get('Authorization'))
      .toBe('Bearer audit-secret-token');
  });

  it('does not authenticate offline or missing-token requests', () => {
    localStorage.setItem('recce_auth_token', 'offline-session');
    expect(forwarded(`${API_BASE_URL}/api/rallies`).headers.has('Authorization')).toBeFalse();
    localStorage.removeItem('recce_auth_token');
    expect(forwarded(`${API_BASE_URL}/api/rallies`).headers.has('Authorization')).toBeFalse();
  });

  it('preserves caller-provided credentials on unrelated requests', () => {
    const original = new HttpRequest('GET', 'https://third-party.invalid/telemetry')
      .clone({ setHeaders: { Authorization: 'Basic external-credentials' } });
    authInterceptor(original, (request) => {
      expect(request).toBe(original);
      expect(request.headers.get('Authorization')).toBe('Basic external-credentials');
      return of(new HttpResponse({ status: 200 }));
    }).subscribe();
  });
});

describe('AUD-SEC-004 authentication HTTP lifecycle', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let previousToken: string | null;
  let previousEmail: string | null;

  beforeEach(() => {
    previousToken = localStorage.getItem('recce_auth_token');
    previousEmail = localStorage.getItem('recce_auth_email');
    localStorage.setItem('recce_auth_token', 'previous-token');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    http.verify();
    if (previousToken === null) localStorage.removeItem('recce_auth_token');
    else localStorage.setItem('recce_auth_token', previousToken);
    if (previousEmail === null) localStorage.removeItem('recce_auth_email');
    else localStorage.setItem('recce_auth_email', previousEmail);
  });

  for (const action of ['login', 'register'] as const) {
    it(`omits an old bearer on ${action} and uses the returned credential on validation`, () => {
      const payload = { email: 'driver@example.test', password: 'test-password' };
      auth[action](payload).subscribe();
      const request = http.expectOne(`${API_BASE_URL}/api/auth/${action}`);
      expect(request.request.headers.has('Authorization')).toBeFalse();
      expect(request.request.body).toEqual(payload);
      request.flush({ token: 'new-token', email: payload.email });
      auth.validate().subscribe();
      const validation = http.expectOne(`${API_BASE_URL}/api/auth/validate`);
      expect(validation.request.headers.get('Authorization')).toBe('Bearer new-token');
      validation.flush(null);
    });
  }

  it('does not send the offline sentinel or a cleared credential', () => {
    auth.enterOffline();
    auth.validate().subscribe();
    const offline = http.expectOne(`${API_BASE_URL}/api/auth/validate`);
    expect(offline.request.headers.has('Authorization')).toBeFalse();
    offline.flush(null);
    auth.clearSession();
    auth.validate().subscribe();
    const cleared = http.expectOne(`${API_BASE_URL}/api/auth/validate`);
    expect(cleared.request.headers.has('Authorization')).toBeFalse();
    cleared.flush(null);
  });
});
