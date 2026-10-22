import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, provideRouter } from '@angular/router';
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
