import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('recce_auth_token');

  if (
    !token ||
    token === 'offline-session' ||
    req.url.includes('/api/auth/login') ||
    req.url.includes('/api/auth/register')
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
