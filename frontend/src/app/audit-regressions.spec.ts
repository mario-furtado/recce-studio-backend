import { HttpRequest, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, of } from 'rxjs';
import { authInterceptor } from './modules/core/interceptors/auth.interceptor';
import {
  OfflineRecceSession,
} from './modules/core/services/offline-recce-store.service';
import { TrackingService } from './modules/core/services/tracking.service';
import { SharedProperties } from './modules/core/shared/shared-properties';
import { OfflineReccesComponent } from './modules/features/offline-recces/offline-recces.component';

describe('Adversarial audit regression evidence', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('AUD-SEC-004 cross-origin bearer disclosure', () => {
    it('does not attach the API bearer token to an unrelated origin', () => {
      localStorage.setItem('recce_auth_token', 'audit-secret-token');
      let forwardedRequest: HttpRequest<unknown> | undefined;

      authInterceptor(
        new HttpRequest('GET', 'https://third-party.invalid/telemetry'),
        (request) => {
          forwardedRequest = request;
          return of(new HttpResponse({ status: 200 }));
        },
      ).subscribe();

      expect(forwardedRequest).toBeDefined();
      expect(forwardedRequest?.headers.has('Authorization')).toBeFalse();
    });
  });

  describe('AUD-REC-001 GPS permission recovery', () => {
    it('does not leave recording active after GPS permission is denied', async () => {
      const permissionDenied = {
        code: 1,
        message: 'Permission denied by audit fixture',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError;
      spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(
        (_success, error) => error?.(permissionDenied),
      );
      spyOn(navigator.geolocation, 'watchPosition').and.callFake(
        (_success, error) => {
          error?.(permissionDenied);
          return 73;
        },
      );
      const shared = {
        error: jasmine.createSpy('error'),
      } as unknown as SharedProperties;
      const service = new TrackingService(shared);

      const started = await service.requestGpsAndStart();

      expect(started).toBeFalse();
      expect(service.registerClick({ text: 'must not be recorded' })).toBeNull();
      service.stopRecce();
    });
  });

  describe('AUD-UI-001 selectable accent themes', () => {
    it('persists every accent theme exposed by the settings UI', () => {
      const shared = new SharedProperties();

      shared.setAccentTheme('midnight-blue');

      expect(shared.accentTheme$.value).toBe('midnight-blue');
      expect(localStorage.getItem('recce_accent_theme')).toBe('midnight-blue');
    });
  });

  describe('offline recce recovery and isolation', () => {
    it('AUD-OFF-001 recovers sessions stranded in syncing after a restart', async () => {
      const stranded = createSession('syncing', 'driver@example.test');
      const component = createOfflineComponent({ sessions: [stranded] });

      await component.loadSessions();

      expect(component.sessions[0].status).toBe('ready_to_sync');
    });

    it('AUD-OFF-002 treats a referenced but missing audio blob as a failed upload', async () => {
      const session = {
        ...createSession('ready_to_sync', 'driver@example.test'),
        audioBlobId: 'missing-audio',
      };
      const component = createOfflineComponent({ sessions: [session] });

      const uploaded = await (
        component as unknown as {
          uploadSessionAudio(
            value: OfflineRecceSession,
            pecId: string,
          ): Promise<boolean>;
        }
      ).uploadSessionAudio(session, 'pec-audit');

      expect(uploaded).toBeFalse();
    });

    it('AUD-OFF-003 does not expose another local account session', async () => {
      const own = createSession('draft', 'driver@example.test', 'own-session');
      const foreign = createSession(
        'ready_to_sync',
        'other@example.test',
        'foreign-session',
      );
      const component = createOfflineComponent({ sessions: [own, foreign] });

      await component.loadSessions();

      expect(component.sessions.map((session) => session.id)).toEqual([
        'own-session',
      ]);
    });
  });
});

function createOfflineComponent(options: {
  sessions: OfflineRecceSession[];
}): OfflineReccesComponent {
  const auth = {
    isAuthenticated: () => true,
    isOfflineSession: () => false,
    getEmail: () => 'driver@example.test',
  };
  const offlineStore = {
    canAccessSession: (session: OfflineRecceSession) => session.userEmail === auth.getEmail(),
    listSessions: jasmine
      .createSpy('listSessions')
      .and.callFake(async () => options.sessions.filter((session) => session.userEmail === auth.getEmail())
        .map((session) => ({ ...session }))),
    recoverInterruptedSyncs: jasmine.createSpy('recoverInterruptedSyncs').and.callFake(async () => {
      options.sessions = options.sessions.map((session) => session.status === 'syncing' && session.userEmail === auth.getEmail()
        ? { ...session, status: 'ready_to_sync' } : session);
    }),
    getAudioBlob: jasmine.createSpy('getAudioBlob').and.resolveTo(null),
    markSessionReadyToSync: jasmine.createSpy('markSessionReadyToSync'),
  };
  const pecService = {
    uploadAudio: jasmine.createSpy('uploadAudio'),
  };
  const rallyService = {};
  const router = {
    navigate: jasmine.createSpy('navigate'),
  };
  const confirmDialog = {};
  const shared = {
    connectionMode$: new BehaviorSubject<'online' | 'offline'>('online'),
    error: jasmine.createSpy('error'),
    info: jasmine.createSpy('info'),
    success: jasmine.createSpy('success'),
  };

  return new OfflineReccesComponent(
    auth as never,
    offlineStore as never,
    pecService as never,
    rallyService as never,
    router as never,
    confirmDialog as never,
    shared as never,
  );
}

function createSession(
  status: OfflineRecceSession['status'],
  userEmail: string,
  id = 'offline-audit-session',
): OfflineRecceSession {
  return {
    id,
    deviceId: 'audit-device',
    userEmail,
    status,
    temporaryName: 'Audit fixture',
    createdAt: '2026-10-09T10:00:00.000Z',
    updatedAt: '2026-10-09T10:05:00.000Z',
    notesCount: 1,
    durationSeconds: 10,
    markers: [
      {
        index: 1,
        timestamp: 10,
        latitude: null,
        longitude: null,
        altitude: null,
        speed: null,
      },
    ],
    gpsTrack: [],
  };
}
