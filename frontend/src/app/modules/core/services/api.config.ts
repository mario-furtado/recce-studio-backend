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

export function apiRequestPath(requestUrl: string, apiBaseUrl = API_BASE_URL): string | null {
  try {
    const target = new URL(requestUrl, document.baseURI);
    const configuredApi = new URL(`${apiBaseUrl.replace(/\/+$/, '')}/api/`, document.baseURI);
    if (
      !['http:', 'https:'].includes(target.protocol) || target.username || target.password ||
      /%(2f|5c)/i.test(target.pathname) ||
      !['http:', 'https:'].includes(configuredApi.protocol) ||
      configuredApi.username || configuredApi.password || configuredApi.search || configuredApi.hash
    ) return null;

    // Trust same-origin API proxy routes and the configured API origin/path only.
    const roots = [new URL('/api/', document.baseURI), configuredApi];
    for (const root of roots) {
      if (target.origin === root.origin && (
        target.pathname === root.pathname.slice(0, -1) || target.pathname.startsWith(root.pathname)
      )) {
        return `/api${target.pathname.slice(root.pathname.length - 1)}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}
