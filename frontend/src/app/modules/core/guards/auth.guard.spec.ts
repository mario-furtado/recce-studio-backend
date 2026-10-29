import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SharedProperties } from '../shared/shared-properties';
import { authGuard } from './auth.guard';

describe('AUD-SEC-006 guard validation race', () => {
  for (const changed of [false, true]) {
    it(`only logs out the session that failed validation (new login: ${changed})`, () => {
      let token = 'old-token';
      const validation = new Subject<void>();
      const logout = jasmine.createSpy('logout');
      TestBed.configureTestingModule({ providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {
          isAuthenticated: () => true, isOfflineSession: () => false,
          getToken: () => token, validate: () => validation, logout,
        } },
        { provide: SharedProperties, useValue: { connectionMode$: new BehaviorSubject('online') } },
      ] });
      const result = TestBed.runInInjectionContext(() => authGuard(
        {} as ActivatedRouteSnapshot, { url: '/rallies' } as RouterStateSnapshot,
      )) as Observable<unknown>;
      result.subscribe();
      if (changed) token = 'new-token';
      validation.error({ status: 401 });
      if (changed) expect(logout).not.toHaveBeenCalled();
      else expect(logout).toHaveBeenCalled();
    });
  }
});

describe('FEAT-002 offline route boundary', () => {
  for (const offlineSession of [false, true]) {
    for (const path of ['/notes', '/notes?from=bookmark', '/tutorial', '/offline-recces', '/recce-mode']) {
      it(`routes ${path} safely with offline session=${offlineSession}`, () => {
        const validate = jasmine.createSpy('validate');
        TestBed.configureTestingModule({ providers: [provideRouter([]),
          { provide: AuthService, useValue: {
            isAuthenticated: () => true, isOfflineSession: () => offlineSession, validate,
          } },
          { provide: SharedProperties, useValue: { connectionMode$: new BehaviorSubject('offline') } },
        ] });
        const result = TestBed.runInInjectionContext(() => authGuard(
          {} as ActivatedRouteSnapshot, { url: path } as RouterStateSnapshot,
        ));
        if (path.startsWith('/notes')) {
          expect(TestBed.inject(Router).serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/offline-recces');
        } else expect(result).toBeTrue();
        expect(validate).not.toHaveBeenCalled();
      });
    }
  }
});
