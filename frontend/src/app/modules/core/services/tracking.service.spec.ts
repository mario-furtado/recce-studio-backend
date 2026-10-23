import { TrackingService } from './tracking.service';
import { SharedProperties } from '../shared/shared-properties';
import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { RecceModeComponent } from '../../features/recce-mode/recce-mode.component';

describe('AUD-REC-001 GPS startup recovery', () => {
  let service: TrackingService;
  let positions: PositionCallback[];
  let errors: PositionErrorCallback[];
  let watchPositions: PositionCallback[];
  let watchErrors: PositionErrorCallback[];
  let clearWatch: jasmine.Spy;

  const denied: GeolocationPositionError = {
    code: 1, message: 'Permission denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3,
  };

  beforeEach(() => {
    positions = []; errors = []; watchPositions = []; watchErrors = [];
    service = new TrackingService({ error: jasmine.createSpy('error') } as unknown as SharedProperties);
    spyOn(console, 'error');
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success, error) => {
      positions.push(success); if (error) errors.push(error);
    });
    spyOn(navigator.geolocation, 'watchPosition').and.callFake((success, error) => {
      watchPositions.push(success); if (error) watchErrors.push(error);
      return watchPositions.length - 1;
    });
    clearWatch = spyOn(navigator.geolocation, 'clearWatch');
  });

  afterEach(() => service.stopRecce());

  function position(latitude = 38.7): GeolocationPosition {
    return { timestamp: Date.now(), coords: { latitude, longitude: -9.1, accuracy: 5,
      altitude: null, altitudeAccuracy: null, heading: null, speed: 2 } };
  }

  it('returns false on permission denial and refuses markers with no active watch', async () => {
    const timers = spyOn(window, 'setTimeout').and.callThrough();
    const clearFallback = spyOn(window, 'clearTimeout').and.callThrough();
    const pending = service.requestGpsAndStart();
    const fallback = timers.calls.mostRecent().returnValue;
    errors[0](denied);
    expect(await pending).toBeFalse();
    expect(service.registerClick({ text: 'must not record' })).toBeNull();
    expect(service.markers).toEqual([]);
    expect(clearWatch).toHaveBeenCalledWith(0);
    expect(clearFallback).toHaveBeenCalledWith(fallback);
    expect(service.currentCoords$.value).toBeNull();
    expect(service.gpsStatus$.value.state).toBe('error');
  });

  it('does not register a watch after synchronous initial permission denial', async () => {
    (navigator.geolocation.getCurrentPosition as jasmine.Spy).and.callFake(
      (_success: PositionCallback, error?: PositionErrorCallback | null) => error?.(denied));
    expect(await service.requestGpsAndStart()).toBeFalse();
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
    expect(service.registerClick()).toBeNull();
  });

  it('clears a watch returned after its callback synchronously denies permission', async () => {
    (navigator.geolocation.watchPosition as jasmine.Spy).and.callFake(
      (_success: PositionCallback, error?: PositionErrorCallback | null) => { error?.(denied); return 0; });
    expect(await service.requestGpsAndStart()).toBeFalse();
    expect(clearWatch).toHaveBeenCalledWith(0);
    positions[0](position());
    expect(service.currentCoords$.value).toBeNull();
    expect(service.registerClick()).toBeNull();
  });

  it('retries after permission is granted, preserving resumed data and ignoring old callbacks', async () => {
    const markers = [{ index: 1, timestamp: 40, latitude: 38, longitude: -9, altitude: null, speed: null }];
    const track = [{ lat: 38, lng: -9, speedKmh: 0, timestamp: 40 }];
    const first = service.requestGpsAndStart(markers, 42, track);
    watchErrors[0](denied);
    expect(await first).toBeFalse();
    expect(service.markers).toEqual(markers);
    expect(service.getGpsTrack()).toEqual(track);
    const second = service.requestGpsAndStart(markers, 42, track);
    positions[0](position(1));
    watchPositions[0](position(2));
    watchErrors[0](denied);
    expect(service.currentCoords$.value).toBeNull();
    expect(service.gpsStatus$.value.state).toBe('searching');
    positions[1](position());
    expect(await second).toBeTrue();
    expect(service.gpsStatus$.value.state).toBe('active');
    const marker = service.registerClick({ text: 'retry works' });
    expect(marker?.latitude).toBe(38.7);
    expect(marker?.timestamp).toBeGreaterThanOrEqual(42);
    expect(service.getGpsTrack().length).toBe(2);
    expect(markers.length).toBe(1);
    expect(track.length).toBe(1);
  });

  it('settles a pending startup as false on stop and cancels its fallback', fakeAsync(() => {
    let result: boolean | undefined;
    service.requestGpsAndStart().then((value) => result = value);
    service.stopRecce();
    flushMicrotasks();
    expect(result).toBeFalse();
    expect(clearWatch).toHaveBeenCalledWith(0);
    tick(16000);
    positions[0](position());
    watchErrors[0](denied);
    expect(result).toBeFalse();
    expect(service.currentCoords$.value).toBeNull();
    expect(service.gpsStatus$.value.state).toBe('idle');
    expect(service.registerClick()).toBeNull();
  }));

  it('settles a superseded attempt and keeps the new watch independent', async () => {
    const first = service.requestGpsAndStart();
    const second = service.requestGpsAndStart();
    expect(await first).toBeFalse();
    expect(clearWatch).toHaveBeenCalledWith(0);
    watchErrors[0](denied);
    watchPositions[0](position(1));
    expect(service.gpsStatus$.value.state).toBe('searching');
    watchPositions[1](position(39));
    expect(await second).toBeTrue();
    expect(service.currentCoords$.value?.lat).toBe(39);
    expect(clearWatch).not.toHaveBeenCalledWith(1);
  });

  it('preserves degraded startup for non-permission GPS errors', async () => {
    const pending = service.requestGpsAndStart();
    errors[0]({ ...denied, code: 2, message: 'Position unavailable' });
    expect(await pending).toBeTrue();
    expect(service.gpsStatus$.value.state).toBe('degraded');
    expect(service.registerClick()).not.toBeNull();
    expect(clearWatch).not.toHaveBeenCalled();
  });

  it('keeps the existing timed fallback but stops if permission is subsequently denied', fakeAsync(() => {
    let result: boolean | undefined;
    service.requestGpsAndStart().then((value) => result = value);
    tick(5999);
    expect(result).toBeUndefined();
    tick(1);
    expect(result).toBeTrue();
    watchErrors[0](denied);
    expect(service.registerClick()).toBeNull();
    expect(clearWatch).toHaveBeenCalledWith(0);
    expect(service.gpsStatus$.value.state).toBe('error');
    watchPositions[0](position());
    tick(16000);
    expect(service.currentCoords$.value).toBeNull();
  }));

  it('ignores positions and errors delivered after a successful recording has stopped', async () => {
    const pending = service.requestGpsAndStart();
    positions[0](position());
    expect(await pending).toBeTrue();
    service.registerClick({ text: 'preserved' });
    const saved = service.stopRecce();
    const track = service.getGpsTrack();
    watchPositions[0](position(1));
    watchErrors[0](denied);
    expect(service.markers).toEqual(saved);
    expect(service.getGpsTrack()).toEqual(track);
    expect(service.gpsStatus$.value.state).toBe('idle');
    expect(service.registerClick()).toBeNull();
  });

  it('fails closed when the geolocation API is unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    try {
      expect(await service.requestGpsAndStart()).toBeFalse();
      expect(service.registerClick()).toBeNull();
      expect(service.gpsStatus$.value.state).toBe('error');
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'geolocation', descriptor);
      else Reflect.deleteProperty(navigator, 'geolocation');
    }
  });

  for (const method of ['getCurrentPosition', 'watchPosition'] as const) {
    it(`fails closed when ${method} throws before returning`, async () => {
      (navigator.geolocation[method] as jasmine.Spy).and.throwError('Geolocation blocked');
      expect(await service.requestGpsAndStart()).toBeFalse();
      expect(service.registerClick()).toBeNull();
      positions.forEach((callback) => callback(position()));
      expect(service.currentCoords$.value).toBeNull();
      expect(service.gpsStatus$.value.state).toBe('error');
    });
  }

  it('leaves the recce page idle without starting audio or offline persistence on denial', async () => {
    const shared = { error: jasmine.createSpy('error'), connectionMode$: new BehaviorSubject('online') };
    const store = { createSession: jasmine.createSpy('createSession') };
    const page = new RecceModeComponent(service, {} as never, {} as never, {} as never,
      shared as unknown as SharedProperties, store as never, {} as never);
    const internal = page as unknown as { primeAudioCue(): void; startAudioCapture(): Promise<boolean> };
    spyOn(internal, 'primeAudioCue');
    const audio = spyOn(internal, 'startAudioCapture');
    const pending = page.toggleRecording();
    errors[0](denied);
    await pending;
    expect(page.isWaitingGps).toBeFalse();
    expect(page.isRecording).toBeFalse();
    expect(audio).not.toHaveBeenCalled();
    expect(store.createSession).not.toHaveBeenCalled();
    expect(service.registerClick()).toBeNull();
  });
});
