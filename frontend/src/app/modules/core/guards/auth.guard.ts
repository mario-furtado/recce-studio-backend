import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SharedProperties } from '../shared/shared-properties';
import { getCrewContext, hasStaleCrewContext } from '../services/crew-context';

const offlineAllowedPaths = ['/recce-mode', '/offline-recces', '/settings', '/tutorial'];

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const shared = inject(SharedProperties);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const path = state.url.split('?')[0];
  if (hasStaleCrewContext() && path !== '/account') return router.createUrlTree(['/account']);
  // Offline ownership has no crew dimension until P09. Never adopt old local data.
  if (getCrewContext() && (['/new-recce', '/recce-mode', '/offline-recces'].some(p => path === p || path.startsWith(p + '/')) || shared.connectionMode$.value === 'offline')) {
    return path === '/account' ? true : router.createUrlTree(['/account']);
  }

  if (auth.isOfflineSession() && shared.connectionMode$.value !== 'offline') {
    shared.setConnectionMode('offline', { silent: true });
  }

  if (shared.connectionMode$.value === 'offline' || auth.isOfflineSession()) {
    return offlineAllowedPaths.some((allowedPath) => path.startsWith(allowedPath))
      ? true
      : router.createUrlTree(['/offline-recces']);
  }

  const token = auth.getToken();
  return auth.validate().pipe(
    map(() => auth.isPersonalAccount() && !['/account', '/settings', '/tutorial', '/offline-recces', '/recce-mode'].some(allowed => path === allowed || path.startsWith(allowed + '/')) ? router.createUrlTree(['/account']) : true),
    catchError(() => {
      if (auth.getToken() === token) auth.logout();
      return of(router.createUrlTree(['/login']));
    }),
  );
};
