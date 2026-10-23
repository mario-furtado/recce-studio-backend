import { BehaviorSubject } from 'rxjs';
import { RecceModeComponent } from './recce-mode.component';
import { OfflineRecceStoreService } from '../../core/services/offline-recce-store.service';
import { AuthService } from '../../core/services/auth.service';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TrackingService } from '../../core/services/tracking.service';
import { RecceNoteParserService } from '../../core/services/recce-note-parser.service';
import { SharedProperties } from '../../core/shared/shared-properties';
import { PecService } from '../../core/services/pecs.service';
import { recceExitGuard } from '../../core/guards/recce-exit.guard';
import { PecDetailComponent } from '../pecs/pec-detail/pec-detail.component';
import { routes } from '../../../app.routes';

@Component({ standalone: true, template: '' })
class AwayComponent {}

describe('AUD-REC-002 audio preservation', () => {
  let store: OfflineRecceStoreService;
  let auth: AuthService;
  let page: RecceModeComponent;
  let databaseName: string;
  let connections: IDBDatabase[];
  let stopTrack: jasmine.Spy;
  let recorder: { state: string; mimeType: string; onstop: ((event: Event) => void) | null; stop: jasmine.Spy };
  let internal: {
    mediaRecorder: MediaRecorder | null; audioStream: MediaStream | null; audioChunks: Blob[];
    offlineSessionId: string | null;
    offlineSaveQueue: Promise<unknown>;
    completeOfflineSession(markers: [], audio: Blob): Promise<unknown>;
    completionPromise?: Promise<unknown> | null;
    stopAudioCapture(): Promise<Blob | null>;
    startAudioCapture(): Promise<boolean>;
  };
  let error: jasmine.Spy;
  let previousStorage: Map<string, string | null>;

  beforeEach(async () => {
    previousStorage = new Map(['recce_device_id', ...['', 'nova-pec'].flatMap((id) =>
      [`recce_timestamps_${id}`, `recce_gps_track_${id}`, `recce_session_id_${id}`])]
      .map((key) => [key, localStorage.getItem(key)]));
    databaseName = `audit-rec-002-${crypto.randomUUID()}`;
    connections = [];
    const open = indexedDB.open.bind(indexedDB);
    spyOn(indexedDB, 'open').and.callFake((name, version) => {
      const request = open(name === 'recce-studio-offline' ? databaseName : name, version);
      request.addEventListener('success', () => connections.push(request.result));
      return request;
    });
    auth = { getEmail: () => 'owner@example.test',
      isAuthenticated: () => true, isOfflineSession: () => false } as AuthService;
    store = new OfflineRecceStoreService(auth);
    const draft = await store.createSession({ temporaryName: 'Audio fixture' });
    error = jasmine.createSpy('error');
    page = new RecceModeComponent({ markers: [], stopRecce: () => [], getGpsTrack: () => [] } as never,
      {} as never, { navigate: jasmine.createSpy('navigate') } as never, {} as never,
      { error, info: jasmine.createSpy('info'), success: jasmine.createSpy('success'),
        connectionMode$: new BehaviorSubject('offline') } as never, store, {} as never);
    internal = page as unknown as typeof internal;
    internal.offlineSessionId = draft.id;
    internal.audioChunks = [new Blob(['first audio'], { type: 'audio/webm' })];
    stopTrack = jasmine.createSpy('track.stop');
    internal.audioStream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    recorder = { state: 'recording', mimeType: 'audio/webm', onstop: null, stop: jasmine.createSpy('recorder.stop') };
    internal.mediaRecorder = recorder as unknown as MediaRecorder;
    page.isRecording = true;
    spyOn(console, 'error');
  });

  afterEach(async () => {
    connections.forEach((connection) => connection.close());
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
    previousStorage.forEach((value, key) => {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    });
  });

  it('persists the stopped audio on component destruction instead of discarding it', async () => {
    const id = internal.offlineSessionId!;
    const saved = spyOn(store, 'completeSession').and.callThrough();
    page.ngOnDestroy();
    internal.audioChunks.push(new Blob([' final chunk']));
    recorder.state = 'inactive';
    recorder.onstop?.(new Event('stop'));
    await internal.completionPromise;
    expect(saved).toHaveBeenCalledTimes(1);
    const session = await store.getSession(id);
    expect(session?.status).toBe('ready_to_sync');
    expect(await (await store.getAudioBlob(session!.audioBlobId!))!.text()).toBe('first audio final chunk');
    expect(stopTrack).toHaveBeenCalled();
  });

  function deliverFinalChunk(): void {
    internal.audioChunks.push(new Blob([' final chunk']));
    recorder.state = 'inactive';
    recorder.onstop?.(new Event('stop'));
  }

  it('waits for final audio and persists once despite repeated finalize and destroy', async () => {
    const id = internal.offlineSessionId!;
    const save = spyOn(store, 'completeSession').and.callThrough();
    const pending = page.toggleRecording();
    expect(page.isSaving).toBeTrue();
    expect(page.canDeactivate()).toBeFalse();
    expect(save).not.toHaveBeenCalled();
    await page.toggleRecording();
    page.ngOnDestroy();
    deliverFinalChunk();
    await pending;
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect((await store.getSession(id))?.audioSize).toBeGreaterThan(0);
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it('retains the same audio and session after a failed save and allows retry before leaving', async () => {
    const id = internal.offlineSessionId!;
    const save = spyOn(store, 'completeSession').and.rejectWith(new Error('Quota exceeded'));
    const pending = page.toggleRecording();
    deliverFinalChunk();
    await pending;
    expect(page.canDeactivate()).toBeFalse();
    expect(page.audioStatus).toBe('Áudio por guardar');
    expect(page.hasPendingSave).toBeTrue();
    expect(internal.offlineSessionId).toBe(id);
    expect((await store.getSession(id))?.status).toBe('draft');
    save.and.callThrough();
    await page.toggleRecording();
    const saved = await store.getSession(id);
    expect(await (await store.getAudioBlob(saved!.audioBlobId!))!.text()).toBe('first audio final chunk');
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(page.canDeactivate()).toBeTrue();
    expect(page.hasPendingSave).toBeFalse();
  });

  it('blocks navigation if completion returns null, retaining audio for a later authorized retry', async () => {
    const id = internal.offlineSessionId!;
    const save = spyOn(store, 'completeSession').and.resolveTo(null);
    const pending = page.toggleRecording();
    deliverFinalChunk();
    await pending;
    expect(page.canDeactivate()).toBeFalse();
    expect(internal.offlineSessionId).toBe(id);
    save.and.callThrough();
    await page.toggleRecording();
    expect((await store.getSession(id))?.status).toBe('ready_to_sync');
  });

  it('requests refresh confirmation only while data or startup is outstanding', () => {
    const recording = new Event('beforeunload', { cancelable: true });
    page.beforeUnload(recording as BeforeUnloadEvent);
    expect(recording.defaultPrevented).toBeTrue();
    page.isRecording = false;
    internal.mediaRecorder = null;
    page.isWaitingGps = true;
    const starting = new Event('beforeunload', { cancelable: true });
    page.beforeUnload(starting as BeforeUnloadEvent);
    expect(starting.defaultPrevented).toBeTrue();
    page.isWaitingGps = false;
    const idle = new Event('beforeunload', { cancelable: true });
    page.beforeUnload(idle as BeforeUnloadEvent);
    expect(idle.defaultPrevented).toBeFalse();
  });

  it('shares the MediaRecorder stop Promise instead of replacing onstop and losing the final chunk', async () => {
    const first = internal.stopAudioCapture();
    const handler = recorder.onstop;
    const second = internal.stopAudioCapture();
    expect(second).toBe(first);
    expect(recorder.onstop).toBe(handler);
    deliverFinalChunk();
    expect(await (await first)!.text()).toBe('first audio final chunk');
    expect(await second).toBe(await first);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
  });

  it('stops a microphone stream granted after the component has been destroyed', async () => {
    internal.mediaRecorder = null;
    internal.audioStream = null;
    page.isRecording = false;
    page.audioSupported = true;
    let grant!: (stream: MediaStream) => void;
    spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(new Promise((resolve) => grant = resolve));
    const pending = internal.startAudioCapture();
    page.ngOnDestroy();
    grant({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream);
    expect(await pending).toBeFalse();
    expect(stopTrack).toHaveBeenCalled();
    expect(internal.mediaRecorder).toBeNull();
  });

  it('protects both production routes and the embedded PEC mode switch', () => {
    const children = routes.find((route) => route.children)?.children!;
    expect(children.find((route) => route.path === 'recce-mode')?.canDeactivate).toContain(recceExitGuard);
    expect(children.find((route) => route.path === 'recce/:id')?.canDeactivate).toContain(recceExitGuard);
    const parent = new PecDetailComponent({} as never, {} as never, {} as never);
    parent.recce = page;
    parent.currentMode = 'RECONNAISSANCE';
    parent.setMode('STUDIO');
    expect(parent.currentMode).toBe('RECONNAISSANCE');
    expect(parent.canDeactivate()).toBeFalse();
  });

  it('integrates the Angular router, unload listener and final MediaRecorder bytes before allowing departure', async () => {
    const id = internal.offlineSessionId!;
    const shared = (page as unknown as { shared: SharedProperties }).shared;
    let unloadListener: EventListenerOrEventListenerObject | undefined;
    const addListener = window.addEventListener.bind(window);
    spyOn(window, 'addEventListener').and.callFake(((type: string, listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions) => {
      if (type === 'beforeunload') unloadListener = listener;
      addListener(type, listener, options);
    }) as typeof window.addEventListener);
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'capture', component: RecceModeComponent, canDeactivate: [recceExitGuard] },
        { path: 'away', component: AwayComponent }, { path: 'offline-recces', component: AwayComponent }]),
      { provide: TrackingService, useValue: page.trackingService },
      { provide: OfflineRecceStoreService, useValue: store }, { provide: SharedProperties, useValue: shared },
      { provide: RecceNoteParserService, useValue: {} }, { provide: PecService, useValue: {} },
    ] });
    TestBed.overrideComponent(RecceModeComponent, { set: { template: '' } });
    const harness = await RouterTestingHarness.create();
    const routed = await harness.navigateByUrl('/capture', RecceModeComponent);
    Object.assign(routed, { offlineSessionId: id, mediaRecorder: internal.mediaRecorder,
      audioStream: internal.audioStream, audioChunks: internal.audioChunks, isRecording: true });
    page = routed;
    internal = routed as unknown as typeof internal;
    const unload = new Event('beforeunload', { cancelable: true });
    // Dispatching on window triggers Karma's own page-reload detector.
    // Exercise the listener actually registered by Angular instead.
    expect(unloadListener).toBeDefined();
    if (typeof unloadListener === 'function') unloadListener.call(window, unload);
    else unloadListener?.handleEvent(unload);
    expect(unload.defaultPrevented).toBeTrue();
    const router = TestBed.inject(Router);
    expect(await router.navigateByUrl('/away')).toBeFalse();
    expect(router.url).toBe('/capture');
    const pending = page.toggleRecording();
    expect(await router.navigateByUrl('/away')).toBeFalse();
    deliverFinalChunk();
    await pending;
    expect(await router.navigateByUrl('/away')).toBeTrue();
    const saved = await store.getSession(id);
    expect(saved?.status).toBe('ready_to_sync');
    expect(await (await store.getAudioBlob(saved!.audioBlobId!))!.text()).toBe('first audio final chunk');
  });

  it('keeps capture available for retry when MediaRecorder.stop throws', async () => {
    const id = internal.offlineSessionId!;
    recorder.stop.and.throwError('Recorder busy');
    await page.toggleRecording();
    expect(page.canDeactivate()).toBeFalse();
    expect(internal.offlineSessionId).toBe(id);
    recorder.stop.and.stub();
    const retry = page.toggleRecording();
    deliverFinalChunk();
    await retry;
    const saved = await store.getSession(id);
    expect(await (await store.getAudioBlob(saved!.audioBlobId!))!.text()).toBe('first audio final chunk');
    expect(page.canDeactivate()).toBeTrue();
  });

  it('waits for an in-flight session creation before persisting teardown audio', async () => {
    const id = internal.offlineSessionId!;
    internal.offlineSessionId = null;
    let created!: () => void;
    internal.offlineSaveQueue = new Promise<void>((resolve) => created = () => {
      internal.offlineSessionId = id; resolve();
    });
    const save = spyOn(store, 'completeSession').and.callThrough();
    page.ngOnDestroy();
    deliverFinalChunk();
    expect(save).not.toHaveBeenCalled();
    created();
    await internal.completionPromise;
    const session = await store.getSession(id);
    expect(session?.status).toBe('ready_to_sync');
    expect(await (await store.getAudioBlob(session!.audioBlobId!))!.text()).toBe('first audio final chunk');
  });

  it('does not transfer a recording to a different account and retries after restoring the owner', async () => {
    const id = internal.offlineSessionId!;
    const email = spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    const pending = page.toggleRecording();
    deliverFinalChunk();
    await pending;
    expect(page.canDeactivate()).toBeFalse();
    expect(await store.getSession(id)).toBeNull();
    email.and.returnValue('owner@example.test');
    expect((await store.getSession(id))?.status).toBe('draft');
    await page.toggleRecording();
    const saved = await store.getSession(id);
    expect(await (await store.getAudioBlob(saved!.audioBlobId!))!.text()).toBe('first audio final chunk');
    expect(saved?.userEmail).toBe('owner@example.test');
    expect(recorder.stop).toHaveBeenCalledTimes(1);
  });

  it('does not announce a downloaded JSON backup when local persistence fails', async () => {
    spyOn(store, 'completeSession').and.rejectWith(new Error('Storage unavailable'));
    await internal.completeOfflineSession([], new Blob(['audio']));
    expect(error).not.toHaveBeenCalledWith('Erro ao guardar offline', 'O JSON de backup foi descarregado como alternativa.');
    expect(internal.offlineSessionId).not.toBeNull();
  });
});
