const localHosts = ['localhost', '127.0.0.1', '::1'];

declare global {
  interface Window {
    __RECCE_STUDIO_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

function resolveApiBaseUrl(): string {
  const configuredUrl = window.__RECCE_STUDIO_CONFIG__?.apiBaseUrl?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (localHosts.includes(window.location.hostname)) {
    return 'http://localhost:8080';
  }

  return '';
}

export const API_BASE_URL = resolveApiBaseUrl();

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
