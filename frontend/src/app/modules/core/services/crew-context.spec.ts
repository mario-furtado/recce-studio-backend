import { HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { clearCrewContext, getCrewContext, setCrewContext } from './crew-context';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { authGuard } from '../guards/auth.guard';
import { AuthService } from './auth.service';
import { SharedProperties } from '../shared/shared-properties';
import { API_BASE_URL } from './api.config';

describe('FEAT-019 crew context boundary', () => {
  let token: string | null, selection: string | null;
  beforeEach(() => { token = localStorage.getItem('recce_auth_token'); selection = sessionStorage.getItem('recce_crew_context'); localStorage.setItem('recce_auth_token', 'session-a'); clearCrewContext(); });
  afterEach(() => {
    if (token === null) localStorage.removeItem('recce_auth_token'); else localStorage.setItem('recce_auth_token', token);
    if (selection === null) clearCrewContext(); else sessionStorage.setItem('recce_crew_context', selection);
  });
  it('binds a tab selection to the exact authenticated session and ignores malformed storage', () => {
    setCrewContext({ id: 'crew-a', name: 'A' }); expect(getCrewContext()?.id).toBe('crew-a');
    localStorage.setItem('recce_auth_token', 'session-b'); expect(getCrewContext()).toBeNull();
    localStorage.setItem('recce_auth_token', 'offline-session'); expect(() => setCrewContext({ id: 'x', name: 'X' })).toThrow();
    sessionStorage.setItem('recce_crew_context', '{broken'); expect(getCrewContext()).toBeNull();
  });
  it('sends context only to trusted workspace requests and snapshots each outgoing request', () => {
    setCrewContext({ id: 'crew-a', name: 'A' });
    let captured: HttpRequest<unknown> | undefined;
    authInterceptor(new HttpRequest('GET', `${API_BASE_URL}/api/rallies`), req => { captured = req; return of(new HttpResponse()); }).subscribe();
    setCrewContext({ id: 'crew-b', name: 'B' }); expect(captured!.headers.get('X-Crew-Id')).toBe('crew-a');
    for (const url of ['https://external.invalid/api/rallies', `${API_BASE_URL}/api/auth/me`, `${API_BASE_URL}/api/crews`]) {
      authInterceptor(new HttpRequest('GET', url), req => { expect(req.headers.has('X-Crew-Id')).toBeFalse(); return of(new HttpResponse()); }).subscribe();
    }
    authInterceptor(new HttpRequest('GET', `${API_BASE_URL}/api/rallies`), req => { expect(req.headers.get('X-Crew-Id')).toBe('crew-b'); return of(new HttpResponse()); }).subscribe();
  });
  it('rejects a stale selection after another tab changes login instead of writing into a legacy fallback', () => {
    setCrewContext({ id: 'crew-a', name: 'A' }); localStorage.setItem('recce_auth_token', 'session-b');
    const transport = jasmine.createSpy('transport');
    authInterceptor(new HttpRequest('POST', `${API_BASE_URL}/api/rallies`, { name: 'Old form' }), transport).subscribe({ error: error => expect(error.status).toBe(409) });
    expect(transport).not.toHaveBeenCalled();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated: () => true } }, { provide: SharedProperties, useValue: { connectionMode$: new BehaviorSubject('online') } }] });
    const result = TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, { url: '/pecs' } as RouterStateSnapshot));
    expect(TestBed.inject(Router).serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/account');
  });
  for (const path of ['/new-recce', '/recce-mode', '/offline-recces']) {
    it(`blocks ambiguous offline capture ${path} for a new crew`, () => {
      setCrewContext({ id: 'crew-a', name: 'A' });
      TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated: () => true } }, { provide: SharedProperties, useValue: { connectionMode$: new BehaviorSubject('online') } }] });
      const result = TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, { url: path } as RouterStateSnapshot));
      expect(TestBed.inject(Router).serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/account');
    });
  }
});
