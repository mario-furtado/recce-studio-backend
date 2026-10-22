import { apiRequestPath } from './api.config';

describe('AUD-SEC-004 configured API URL boundary', () => {
  const base = 'https://api.example.test/gateway';

  for (const url of [
    'https://api.example.test/gateway/api/rallies',
    'https://api.example.test:443/gateway/api/rallies?year=2026',
  ]) {
    it(`accepts the configured origin and path: ${url}`, () => {
      expect(apiRequestPath(url, base)).toBe('/api/rallies');
    });
  }

  it('resolves protocol-relative URLs using the document protocol and rejects a scheme mismatch', () => {
    const otherProtocol = window.location.protocol === 'http:' ? 'https:' : 'http:';
    const url = '//api.example.test/gateway/api/rallies';
    expect(apiRequestPath(url, `${window.location.protocol}//api.example.test/gateway`)).toBe('/api/rallies');
    expect(apiRequestPath(url, `${otherProtocol}//api.example.test/gateway`)).toBeNull();
  });

  for (const url of [
    'https://api.example.test.evil.test/gateway/api/rallies',
    'https://api.example.test@evil.test/gateway/api/rallies',
    'https://user:secret@api.example.test/gateway/api/rallies',
    'http://api.example.test/gateway/api/rallies',
    'https://api.example.test:444/gateway/api/rallies',
    'https://api.example.test/api/rallies',
    'https://api.example.test/gateway/api-evil/rallies',
    'https://api.example.test/gateway-evil/api/rallies',
    'https://api.example.test/gateway/api/../../telemetry',
    'https://api.example.test/gateway/api/%2e%2e/%2e%2e/telemetry',
    'https://api.example.test/gateway/api/%2f..%2ftelemetry',
    'https://api.example.test/gateway/api/%5c..%5ctelemetry',
    'https://evil.test/collect?next=https://api.example.test/gateway/api/rallies',
    '/assets/telemetry',
  ]) {
    it(`rejects an origin/path confusion: ${url}`, () => {
      expect(apiRequestPath(url, base)).toBeNull();
    });
  }

  it('supports same-origin API proxy routes alongside a configured API', () => {
    expect(apiRequestPath('/api/rallies', base)).toBe('/api/rallies');
    expect(apiRequestPath(`${window.location.origin}/api/rallies`, base)).toBe('/api/rallies');
  });

  it('supports same-origin deployment and a relative configured base path', () => {
    expect(apiRequestPath('/api/rallies', '')).toBe('/api/rallies');
    expect(apiRequestPath('/gateway/api/rallies', '/gateway/')).toBe('/api/rallies');
    expect(apiRequestPath('https://third-party.invalid/api/rallies', '')).toBeNull();
  });

  for (const config of ['http://[invalid', 'data:text/plain,api', 'https://api.example.test?next=', 'https://api.example.test/#api']) {
    it(`fails closed for invalid configured API base ${config}`, () => {
      expect(apiRequestPath('https://api.example.test/telemetry', config)).toBeNull();
    });
  }
});
