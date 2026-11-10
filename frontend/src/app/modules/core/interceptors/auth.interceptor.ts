import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { apiRequestPath } from '../services/api.config';
import { getCrewContext, hasStaleCrewContext } from '../services/crew-context';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('recce_auth_token');
  const path = apiRequestPath(req.url);

  if (
    !token ||
    token === 'offline-session' ||
    path === null ||
    /^\/api\/auth\/(login|register|account-options|verification\/request|verify-email|password-reset\/(request|confirm))\/?$/.test(path)
  ) {
    return next(req);
  }

  const crew = getCrewContext();
  const workspaceRequest = !/^\/api\/(auth|crews|shared-rallies|invitations|notifications)(\/|$)/.test(path)
    && !/^\/api\/rallies\/[^/]+\/invitations(\/|$)/.test(path);
  if (workspaceRequest && hasStaleCrewContext()) return throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'A sessão mudou. Escolhe novamente a tripulação na tua conta.' } }));
  const contextHeaders: Record<string, string> = crew && workspaceRequest ? { 'X-Crew-Id': crew.id } : {};
  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        ...contextHeaders,
      },
    }),
  );
};
