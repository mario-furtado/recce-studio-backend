import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SharedProperties } from '../shared/shared-properties';

const offlineAllowedPaths = ['/recce-mode', '/offline-recces', '/settings', '/tutorial'];

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const shared = inject(SharedProperties);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const path = state.url.split('?')[0];

  if (auth.isOfflineSession() && shared.connectionMode$.value !== 'offline') {
    shared.setConnectionMode('offline', { silent: true });
  }

  if (shared.connectionMode$.value === 'offline' || auth.isOfflineSession()) {
    return offlineAllowedPaths.some((allowedPath) => path.startsWith(allowedPath))
      ? true
      : router.createUrlTree(['/offline-recces']);
  }

  return auth.validate().pipe(
    map(() => true),
    catchError(() => {
      auth.logout();
      return of(router.createUrlTree(['/login']));
    }),
  );
};
