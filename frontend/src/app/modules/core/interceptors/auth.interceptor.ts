import { HttpInterceptorFn } from '@angular/common/http';
import { apiRequestPath } from '../services/api.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('recce_auth_token');
  const path = apiRequestPath(req.url);

  if (
    !token ||
    token === 'offline-session' ||
    path === null ||
    /^\/api\/auth\/(login|register)\/?$/.test(path)
  ) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
