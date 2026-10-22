import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { OfflineRecceSession, OfflineRecceStoreService } from '../../core/services/offline-recce-store.service';
import { OfflineRecceSyncResponse, PecService } from '../../core/services/pecs.service';
import { RallyService } from '../../core/services/rally.service';
import { SharedProperties } from '../../core/shared/shared-properties';
import { ConfirmDialogService } from '../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { Router } from '@angular/router';
import { OfflineReccesComponent } from './offline-recces.component';
import { PecsEditorComponent } from '../pecs/pecs-editor/pecs-editor.component';
import { RecceModeComponent } from '../recce-mode/recce-mode.component';

describe('AUD-OFF-001 persisted synchronization recovery', () => {
  let store: OfflineRecceStoreService;
  let auth: AuthService;
  let databaseName: string;
  let connections: IDBDatabase[];
  let previousDevice: string | null;

  beforeEach(() => {
    databaseName = `audit-off-001-${crypto.randomUUID()}`;
    connections = [];
    previousDevice = localStorage.getItem('recce_device_id');
    const open = indexedDB.open.bind(indexedDB);
    spyOn(indexedDB, 'open').and.callFake((name, version) => {
      const request = open(name === 'recce-studio-offline' ? databaseName : name, version);
      request.addEventListener('success', () => connections.push(request.result));
      return request;
    });
    auth = {
      getEmail: () => 'driver@example.test', isAuthenticated: () => true, isOfflineSession: () => false,
    } as AuthService;
    store = new OfflineRecceStoreService(auth);
  });

  afterEach(async () => {
    connections.forEach((connection) => connection.close());
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    if (previousDevice === null) localStorage.removeItem('recce_device_id');
    else localStorage.setItem('recce_device_id', previousDevice);
  });

  function component(storage: OfflineRecceStoreService, pec = {} as PecService): OfflineReccesComponent {
    return new OfflineReccesComponent(auth, storage, pec,
      { getRallies: () => of([]) } as unknown as RallyService, {} as Router, {} as ConfirmDialogService,
      { connectionMode$: new BehaviorSubject('online'), error: jasmine.createSpy('error'),
        info: jasmine.createSpy('info'), success: jasmine.createSpy('success') } as unknown as SharedProperties);
  }

  it('recovers a persisted syncing session after a new service/page lifetime without losing its recording', async () => {
    const draft = await store.createSession({ temporaryName: 'Interrupted fixture', pecId: 'pec-fixture' });
    const audio = new Blob(['preserved audio'], { type: 'audio/webm' });
    const completed = await store.completeSession(draft.id, [{
      index: 1, timestamp: 10, latitude: 38.7, longitude: -9.1, altitude: null, speed: null,
    }], audio, []);
    await store.markSessionSyncing(draft.id);
    const restartedStore = new OfflineRecceStoreService(auth);
    const page = component(restartedStore);
    await page.loadSessions();
    expect(page.sessions[0].status).toBe('ready_to_sync');
    const recovered = await restartedStore.getSession(draft.id);
    expect(recovered?.status).toBe('ready_to_sync');
    expect(recovered?.id).toBe(draft.id);
    expect(recovered?.markers).toEqual(completed?.markers);
    expect(recovered?.audioBlobId).toBe(completed?.audioBlobId);
    expect(await (await restartedStore.getAudioBlob(recovered!.audioBlobId!))!.text()).toBe('preserved audio');
  });

  async function ready(): Promise<OfflineRecceSession> {
    const draft = await store.createSession({ temporaryName: 'Sync fixture', pecId: 'pec-fixture' });
    const session = await store.completeSession(draft.id, [], new Blob(['audio'], { type: 'audio/webm' }),
      [{ lat: 38.7, lng: -9.1, timestamp: 5, speedKmh: 20 }]);
    if (!session) throw new Error('Could not create fixture');
    return session;
  }

  function response(id: string): OfflineRecceSyncResponse {
    return { syncId: 'remote-sync', offlineSessionId: id, pecId: 'pec-fixture', pecName: 'PEC fixture',
      notesCount: 0, syncedAt: new Date().toISOString() };
  }

  function remote(id: string): jasmine.SpyObj<PecService> {
    const pec = jasmine.createSpyObj<PecService>('pec', ['syncOfflineRecce', 'uploadAudio']);
    pec.syncOfflineRecce.and.returnValue(of(response(id)));
    pec.uploadAudio.and.returnValue(of({ hasVideo: false, hasAudio: true, hasGps: false }));
    return pec;
  }

  it('keeps live progress when the page reloads its list and ignores a repeated click', async () => {
    const session = await ready();
    const pec = remote(session.id);
    const reply = new Subject<OfflineRecceSyncResponse>();
    let started!: () => void;
    const sent = new Promise<void>((resolve) => started = resolve);
    pec.syncOfflineRecce.and.callFake(() => { started(); return reply; });
    const page = component(store, pec);
    page.sessions = await store.listSessions();
    const pending = page.syncSession(session);
    await sent;
    await page.loadSessions();
    expect(page.sessions[0].status).toBe('syncing');
    expect(page.syncingSessionId).toBe(session.id);
    expect(page.statusLabel(page.sessions[0].status)).toBe('A sincronizar');
    await page.syncSession(session);
    expect(pec.syncOfflineRecce).toHaveBeenCalledTimes(1);
    reply.next(response(session.id));
    reply.complete();
    await pending;
    expect(page.syncingSessionId).toBeNull();
    expect(await store.getSession(session.id)).toBeNull();
    expect(await store.getAudioBlob(session.audioBlobId!)).toBeNull();
  });

  it('AUD-OFF-002 reports a missing referenced Blob as an unsuccessful upload', async () => {
    const session = { ...await ready(), audioBlobId: 'missing-audio' };
    const pec = remote(session.id);
    const page = component(store, pec);
    const uploaded = await (page as unknown as {
      uploadSessionAudio(value: OfflineRecceSession, pecId: string): Promise<boolean>;
    }).uploadSessionAudio(session, 'pec-fixture');
    expect(uploaded).toBeFalse();
    expect(pec.uploadAudio).not.toHaveBeenCalled();
  });

  it('AUD-OFF-003 hides another account sessions and audio even with known ids', async () => {
    const session = await ready();
    spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    expect(await store.listSessions()).toEqual([]);
    expect(await store.getSession(session.id)).toBeNull();
    expect(await store.getAudioBlob(session.audioBlobId!)).toBeNull();
  });

  it('AUD-OFF-003 denies foreign mutations and sync callbacks without changing stored data', async () => {
    const session = await ready();
    const email = spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    expect(await store.saveSnapshot(session.id, [])).toBeNull();
    expect(await store.completeSession(session.id, [], new Blob(['foreign']))).toBeNull();
    expect(await store.markSessionSyncing(session.id)).toBeNull();
    expect(await store.markSessionReadyToSync(session.id, 'foreign')).toBeNull();
    expect(await store.markSessionSynced(session.id, 'foreign-pec')).toBeNull();
    const send = jasmine.createSpy('send').and.resolveTo();
    expect(await store.runSessionSync(session.id, send)).toBeFalse();
    expect(send).not.toHaveBeenCalled();
    try { await store.deleteSession(session.id); } catch { /* Denial may reject. */ }
    email.and.returnValue('driver@example.test');
    expect(await store.getSession(session.id)).toEqual(session);
    expect(await (await store.getAudioBlob(session.audioBlobId!))!.text()).toBe('audio');
  });

  it('AUD-OFF-003 refuses a forged foreign draft in the continue action', async () => {
    const session = await store.createSession({ temporaryName: 'Owner draft' });
    spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    const page = component(store);
    const router = (page as unknown as { router: Router }).router;
    router.navigate = jasmine.createSpy('navigate');
    await page.continueSession({ ...session, userEmail: 'other@example.test' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('AUD-OFF-003 does not expose local records after logout despite a stale email', async () => {
    await ready();
    spyOn(auth, 'isAuthenticated').and.returnValue(false);
    expect(await store.listSessions()).toEqual([]);
  });

  async function rawSession(session: OfflineRecceSession): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const transaction = connections[0].transaction('recceSessions', 'readwrite');
      transaction.objectStore('recceSessions').put(session);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
  }

  it('AUD-OFF-003 keeps anonymous legacy data quarantined and explicit offline data separate', async () => {
    const owned = await ready();
    const legacy = { ...owned, id: 'anonymous-legacy', userEmail: null };
    await rawSession(legacy);
    expect((await store.listSessions()).map((session) => session.id)).toEqual([owned.id]);
    const email = spyOn(auth, 'getEmail').and.returnValue('offline@recce.local');
    const offline = spyOn(auth, 'isOfflineSession').and.returnValue(true);
    const guest = await store.createSession({ temporaryName: 'Explicit offline' });
    expect(guest.userEmail).toBe('offline@recce.local');
    expect((await store.listSessions()).map((session) => session.id)).toEqual([guest.id]);
    expect(await store.getSession(legacy.id)).toBeNull();
    expect(await store.getSession(owned.id)).toBeNull();
    email.and.returnValue('other@example.test');
    offline.and.returnValue(false);
    expect(await store.listSessions()).toEqual([]);
    expect(await store.getSession(guest.id)).toBeNull();
    email.and.returnValue('driver@example.test');
    expect((await store.getSession(owned.id))?.userEmail).toBe('driver@example.test');
    expect(await store.getSession(legacy.id)).toBeNull();
  });

  it('AUD-OFF-003 normalizes owner email but rejects the reserved offline identity without offline mode', async () => {
    const session = await ready();
    const email = spyOn(auth, 'getEmail').and.returnValue(' DRIVER@EXAMPLE.TEST ');
    expect((await store.getSession(session.id))?.id).toBe(session.id);
    email.and.returnValue('offline@recce.local');
    expect(await store.listSessions()).toEqual([]);
    await expectAsync(store.createSession({})).toBeRejected();
  });

  it('AUD-OFF-003 rejects a delayed read when the account changes before completion', async () => {
    const session = await ready();
    const email = spyOn(auth, 'getEmail').and.returnValue('driver@example.test');
    const get = IDBObjectStore.prototype.get;
    spyOn(IDBObjectStore.prototype, 'get').and.callFake(function(this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      const request = get.call(this, key);
      request.addEventListener('success', () => email.and.returnValue('other@example.test'));
      return request;
    });
    await expectAsync(store.getSession(session.id)).toBeRejected();
  });

  it('AUD-OFF-003 aborts an update if the account changes inside the write transaction', async () => {
    const session = await store.createSession({ temporaryName: 'Draft' });
    const email = spyOn(auth, 'getEmail').and.returnValue('driver@example.test');
    const get = IDBObjectStore.prototype.get;
    const interception = spyOn(IDBObjectStore.prototype, 'get').and.callFake(function(this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      const request = get.call(this, key);
      if (this.transaction.mode === 'readwrite') {
        request.addEventListener('success', () => email.and.returnValue('other@example.test'));
      }
      return request;
    });
    await expectAsync(store.saveSnapshot(session.id, [])).toBeRejected();
    interception.and.callThrough();
    email.and.returnValue('driver@example.test');
    expect(await store.getSession(session.id)).toEqual(session);
  });

  it('AUD-OFF-003 does not read or delete foreign audio through a forged owned reference', async () => {
    const foreign = await ready();
    const email = spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    const own = await ready();
    await rawSession({ ...own, audioBlobId: foreign.audioBlobId });
    expect(await store.getAudioBlob(foreign.audioBlobId!)).toBeNull();
    await store.deleteSession(own.id);
    email.and.returnValue('driver@example.test');
    expect(await (await store.getAudioBlob(foreign.audioBlobId!))!.text()).toBe('audio');
    expect(await store.getSession(foreign.id)).toEqual(foreign);
  });

  it('AUD-OFF-003 blocks forged foreign sync/create/delete actions and cached counts', async () => {
    spyOn(console, 'error');
    const session = await ready();
    const email = spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    const pec = remote(session.id);
    const page = component(store, pec);
    page.sessions = [session];
    expect(page.visibleSessions).toEqual([]);
    expect(page.pendingCount).toBe(0);
    const forged = { ...session, userEmail: 'other@example.test' };
    await page.syncSession(forged);
    page.newPecDrafts[session.id] = { rallyId: 'rally', number: 1, name: 'Forged', distanceKm: 1 };
    await page.createPecAndSync(forged);
    (page as unknown as { confirmDialog: ConfirmDialogService }).confirmDialog.confirm =
      jasmine.createSpy('confirm').and.resolveTo(true);
    await page.deleteSession(forged);
    expect(pec.syncOfflineRecce).not.toHaveBeenCalled();
    expect(pec.uploadAudio).not.toHaveBeenCalled();
    email.and.returnValue('driver@example.test');
    expect(await store.getSession(session.id)).toEqual(session);
  });

  it('AUD-OFF-003 does not send another account backup through the PEC editor', async () => {
    const session = await ready();
    spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    const pec = remote(session.id);
    const page = component(store, pec);
    const editor = new PecsEditorComponent({} as never, pec, store,
      (page as unknown as { shared: SharedProperties }).shared, {} as ConfirmDialogService);
    editor.pecId = 'pec-fixture';
    spyOn(editor, 'loadNotesFromDatabase');
    const key = 'recce_session_id_pec-fixture';
    const previous = localStorage.getItem(key);
    try {
      localStorage.setItem(key, session.id);
      await editor.syncRecceMarkersToBackend([{ timestamp: 1, text: 'foreign' }]);
      expect(pec.syncOfflineRecce).not.toHaveBeenCalled();
      localStorage.removeItem(key);
      await editor.syncRecceMarkersToBackend([{ timestamp: 1, text: 'anonymous legacy' }]);
      expect(pec.syncOfflineRecce).not.toHaveBeenCalled();
    } finally {
      if (previous === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous);
    }
  });

  it('AUD-OFF-003 blocks immediate sync and resumption of another account recording', async () => {
    spyOn(console, 'error');
    const session = await ready();
    const email = spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    const pec = remote(session.id);
    const shared = (component(store) as unknown as { shared: SharedProperties }).shared;
    const recce = new RecceModeComponent({} as never, {} as never, {} as Router,
      {} as never, shared, store, pec);
    recce.pecId = 'pec-fixture';
    const internal = recce as unknown as {
      resumeSession: OfflineRecceSession | null; offlineSessionId: string | null;
      startOfflineSession(): Promise<void>;
      syncCompletedSessionIfOnline(session: OfflineRecceSession, markers: [], gps: [], audio: null): Promise<string>;
    };
    expect(await internal.syncCompletedSessionIfOnline(session, [], [], null)).toBe('offline');
    expect(pec.syncOfflineRecce).not.toHaveBeenCalled();
    email.and.returnValue('driver@example.test');
    const draft = await store.createSession({ temporaryName: 'Owner draft' });
    email.and.returnValue('other@example.test');
    internal.resumeSession = draft;
    const start = jasmine.createSpy('requestGpsAndStart');
    recce.trackingService.requestGpsAndStart = start;
    await recce.toggleRecording();
    expect(start).not.toHaveBeenCalled();
    expect(recce.isRecording).toBeFalse();
    internal.resumeSession = draft;
    await internal.startOfflineSession();
    expect(internal.offlineSessionId).toBeNull();
    email.and.returnValue('driver@example.test');
    expect(await store.getSession(draft.id)).toEqual(draft);
  });

  it('AUD-OFF-003 still allows the owner to continue a persisted draft', async () => {
    const draft = await store.createSession({ temporaryName: 'Owned draft' });
    const page = component(store);
    const router = (page as unknown as { router: Router }).router;
    router.navigate = jasmine.createSpy('navigate');
    await page.continueSession(draft);
    expect(router.navigate).toHaveBeenCalledWith(['/recce-mode'], { queryParams: { offlineSessionId: draft.id } });
  });

  it('AUD-OFF-003 stops starting a resumed recording if the account changes while GPS is pending', async () => {
    const draft = await store.createSession({ temporaryName: 'Owned draft' });
    const email = spyOn(auth, 'getEmail').and.returnValue('driver@example.test');
    const shared = (component(store) as unknown as { shared: SharedProperties }).shared;
    const recce = new RecceModeComponent({} as never, {} as never, {} as Router,
      {} as never, shared, store, {} as PecService);
    const internal = recce as unknown as {
      resumeSession: OfflineRecceSession | null; offlineSessionId: string | null;
      primeAudioCue(): void; startAudioCapture(): Promise<boolean>; stopAudioCapture(): Promise<Blob | null>;
    };
    internal.resumeSession = draft;
    internal.offlineSessionId = draft.id;
    spyOn(internal, 'primeAudioCue');
    spyOn(internal, 'startAudioCapture').and.resolveTo(true);
    const stoppedAudio = spyOn(internal, 'stopAudioCapture').and.resolveTo(null);
    recce.trackingService.requestGpsAndStart = jasmine.createSpy('startGps').and.callFake(async () => {
      email.and.returnValue('other@example.test');
      return true;
    });
    recce.trackingService.stopRecce = jasmine.createSpy('stopGps').and.returnValue([]);
    await recce.toggleRecording();
    expect(recce.isRecording).toBeFalse();
    expect(recce.isWaitingGps).toBeFalse();
    expect(stoppedAudio).toHaveBeenCalled();
    expect(recce.trackingService.stopRecce).toHaveBeenCalled();
    expect(internal.resumeSession).toBeNull();
    expect(internal.offlineSessionId).toBeNull();
    email.and.returnValue('driver@example.test');
    expect(await store.getSession(draft.id)).toEqual(draft);
  });

  it('AUD-OFF-003 uses owned persisted data in the PEC editor and ignores a late reply after switching accounts', async () => {
    const session = await ready();
    const email = spyOn(auth, 'getEmail').and.returnValue('driver@example.test');
    const pec = remote(session.id);
    const reply = new Subject<OfflineRecceSyncResponse>();
    pec.syncOfflineRecce.and.returnValue(reply);
    const shared = (component(store) as unknown as { shared: SharedProperties }).shared;
    const editor = new PecsEditorComponent({} as never, pec, store, shared, {} as ConfirmDialogService);
    editor.pecId = 'pec-fixture';
    const key = 'recce_session_id_pec-fixture';
    const previous = localStorage.getItem(key);
    try {
      localStorage.setItem(key, session.id);
      await editor.syncRecceMarkersToBackend([{ timestamp: 99, text: 'untrusted cache' }]);
      const request = pec.syncOfflineRecce.calls.mostRecent().args[0];
      expect(request.sessionId).toBe(session.id);
      expect(request.markers).toEqual(session.markers);
      expect(request.gpsTrack).toEqual(session.gpsTrack);
      expect(request.userEmail).toBe(session.userEmail);
      email.and.returnValue('other@example.test');
      reply.next(response(session.id));
      reply.complete();
      expect(pec.uploadAudio).not.toHaveBeenCalled();
      expect(localStorage.getItem(key)).toBe(session.id);
      email.and.returnValue('driver@example.test');
      expect(await store.getSession(session.id)).toEqual(session);
    } finally {
      if (previous === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous);
    }
  });

  it('AUD-OFF-003 rolls back session and audio deletion together if the transaction aborts', async () => {
    const session = await ready();
    const remove = IDBObjectStore.prototype.delete;
    const interception = spyOn(IDBObjectStore.prototype, 'delete').and.callFake(function(this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      const request = remove.call(this, key);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expectAsync(store.deleteSession(session.id)).toBeRejected();
    interception.and.callThrough();
    expect(await store.getSession(session.id)).toEqual(session);
    expect(await (await store.getAudioBlob(session.audioBlobId!))!.text()).toBe('audio');
  });

  it('AUD-OFF-001/002/003 isolates an interrupted session with missing audio and retries safely as its owner', async () => {
    const draft = await store.createSession({ temporaryName: 'Joint verification', pecId: 'pec-fixture' });
    const session = (await store.completeSession(draft.id, [{
      index: 1, timestamp: 10, latitude: 38.7, longitude: -9.1, altitude: null, speed: null,
    }], new Blob(['joint audio'], { type: 'audio/webm' }),
    [{ lat: 38.7, lng: -9.1, timestamp: 10, speedKmh: 20 }]))!;
    await store.markSessionSyncing(session.id);
    let recording: unknown;
    await new Promise<void>((resolve, reject) => {
      const transaction = connections[0].transaction('recceAudio', 'readwrite');
      const audio = transaction.objectStore('recceAudio');
      const request = audio.get(session.audioBlobId!);
      request.onsuccess = () => { recording = request.result; audio.delete(session.audioBlobId!); };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    expect(recording).toBeDefined();
    const email = spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    const restarted = new OfflineRecceStoreService(auth);
    const pec = remote(session.id);
    const page = component(restarted, pec);
    await page.loadSessions();
    expect(page.visibleSessions).toEqual([]);
    expect(page.pendingCount).toBe(0);
    await page.syncSession({ ...session, status: 'ready_to_sync', userEmail: 'other@example.test' });
    expect(pec.syncOfflineRecce).not.toHaveBeenCalled();
    await expectAsync(restarted.deleteSession(session.id)).toBeRejected();

    email.and.returnValue('driver@example.test');
    expect((await restarted.getSession(session.id))?.status).toBe('syncing');
    await page.loadSessions();
    expect(page.sessions[0].status).toBe('ready_to_sync');
    await page.syncSession(page.sessions[0]);
    const retained = await restarted.getSession(session.id);
    expect(retained?.status).toBe('ready_to_sync');
    expect(retained?.audioBlobId).toBe(session.audioBlobId);
    expect(retained?.markers).toEqual(session.markers);
    expect(retained?.gpsTrack).toEqual(session.gpsTrack);
    expect(retained?.syncError).toContain('em falta');
    expect(pec.uploadAudio).not.toHaveBeenCalled();
    expect(page.syncingSessionId).toBeNull();

    await new Promise<void>((resolve, reject) => {
      const transaction = connections[0].transaction('recceAudio', 'readwrite');
      transaction.objectStore('recceAudio').put(recording);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    await page.syncSession(retained!);
    expect(pec.syncOfflineRecce.calls.allArgs().map(([request]) => request.sessionId)).toEqual([session.id, session.id]);
    expect(pec.syncOfflineRecce.calls.allArgs().every(([request]) => request.userEmail === session.userEmail
      && request.markers.length === 1 && request.gpsTrack?.length === 1)).toBeTrue();
    expect(pec.uploadAudio).toHaveBeenCalledTimes(1);
    expect(await (pec.uploadAudio.calls.mostRecent().args[1] as Blob).text()).toBe('joint audio');
    expect(await restarted.getSession(session.id)).toBeNull();
    expect(await restarted.getAudioBlob(session.audioBlobId!)).toBeNull();
    expect(page.visibleSessions).toEqual([]);
    expect(page.syncingSessionId).toBeNull();
  });

  it('AUD-OFF-002 retains missing-audio metadata across repeated sync and page restart', async () => {
    const session = await ready();
    await new Promise<void>((resolve, reject) => {
      const transaction = connections[0].transaction('recceAudio', 'readwrite');
      transaction.objectStore('recceAudio').delete(session.audioBlobId!);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    const pec = remote(session.id);
    const page = component(store, pec);
    const deletion = spyOn(store, 'deleteSession').and.callThrough();
    page.sessions = await store.listSessions();
    await page.syncSession(session);
    const retained = await store.getSession(session.id);
    expect(retained).not.toBeNull();
    expect(retained?.status).toBe('ready_to_sync');
    expect(retained?.syncError).toContain('em falta');
    expect(retained?.audioBlobId).toBe(session.audioBlobId);
    expect(retained?.audioMimeType).toBe(session.audioMimeType);
    expect(retained?.audioSize).toBe(session.audioSize);
    expect(retained?.markers).toEqual(session.markers);
    expect(retained?.gpsTrack).toEqual(session.gpsTrack);
    expect(page.syncingSessionId).toBeNull();
    expect(deletion).not.toHaveBeenCalled();
    expect(pec.uploadAudio).not.toHaveBeenCalled();
    expect((page as unknown as { shared: SharedProperties }).shared.success).not.toHaveBeenCalled();
    expect((page as unknown as { shared: SharedProperties }).shared.error).toHaveBeenCalledWith(
      'Áudio não sincronizado', jasmine.stringMatching(/Não apagues/));
    if (!retained) return;
    const restarted = component(new OfflineRecceStoreService(auth), pec);
    await restarted.loadSessions();
    expect(restarted.sessions[0].audioBlobId).toBe(session.audioBlobId);
    await restarted.syncSession(restarted.sessions[0]);
    expect((await store.getSession(session.id))?.status).toBe('ready_to_sync');
    expect(pec.syncOfflineRecce.calls.allArgs().map(([request]) => request.sessionId)).toEqual([session.id, session.id]);
    expect(restarted.syncingSessionId).toBeNull();
  });

  it('AUD-OFF-002 still synchronizes a session recorded without audio', async () => {
    const draft = await store.createSession({ temporaryName: 'No recording', pecId: 'pec-fixture' });
    const session = await store.completeSession(draft.id, [], null);
    const pec = remote(draft.id);
    await component(store, pec).syncSession(session!);
    expect(pec.uploadAudio).not.toHaveBeenCalled();
    expect(await store.getSession(draft.id)).toBeNull();
  });

  it('AUD-OFF-002 preserves the recording and retry state when reading IndexedDB fails', async () => {
    spyOn(console, 'error');
    const session = await ready();
    const read = spyOn(store, 'getAudioBlob').and.rejectWith(new Error('storage unavailable'));
    const pec = remote(session.id);
    const page = component(store, pec);
    await page.syncSession(session);
    expect((await store.getSession(session.id))?.status).toBe('ready_to_sync');
    expect(pec.uploadAudio).not.toHaveBeenCalled();
    expect(page.syncingSessionId).toBeNull();
    read.and.callThrough();
    expect(await (await store.getAudioBlob(session.audioBlobId!))!.text()).toBe('audio');
    await page.syncSession((await store.getSession(session.id))!);
    expect(await store.getSession(session.id)).toBeNull();
  });

  it('uses Web Locks to leave a second service instance live sync untouched', async () => {
    expect(navigator.locks).toBeDefined();
    const session = await ready();
    let started!: () => void;
    let release!: () => void;
    const began = new Promise<void>((resolve) => started = resolve);
    const wait = new Promise<void>((resolve) => release = resolve);
    const pending = store.runSessionSync(session.id, async () => {
      started();
      await wait;
      await store.markSessionReadyToSync(session.id);
    });
    await began;
    const second = new OfflineRecceStoreService(auth);
    await second.recoverInterruptedSyncs();
    expect((await second.getSession(session.id))?.status).toBe('syncing');
    const duplicate = jasmine.createSpy('duplicate').and.resolveTo();
    expect(await second.runSessionSync(session.id, duplicate)).toBeFalse();
    expect(duplicate).not.toHaveBeenCalled();
    release();
    await pending;
    expect((await second.getSession(session.id))?.status).toBe('ready_to_sync');
  });

  it('keeps progress and the live claim through the audio upload phase', async () => {
    const session = await ready();
    const pec = remote(session.id);
    const audio = new Subject<{ hasVideo: boolean; hasAudio: boolean; hasGps: boolean }>();
    let started!: () => void;
    const began = new Promise<void>((resolve) => started = resolve);
    pec.uploadAudio.and.callFake(() => { started(); return audio; });
    const page = component(store, pec);
    page.sessions = await store.listSessions();
    const pending = page.syncSession(session);
    await began;
    await page.loadSessions();
    expect(page.sessions[0].status).toBe('syncing');
    expect(page.syncingSessionId).toBe(session.id);
    audio.next({ hasVideo: false, hasAudio: true, hasGps: false });
    audio.complete();
    await pending;
    expect(await store.getSession(session.id)).toBeNull();
  });

  it('preserves draft, ready, synced and conflict states during recovery', async () => {
    const draft = await store.createSession({ temporaryName: 'Draft' });
    const pending = await ready();
    const synced = await ready();
    await store.markSessionSynced(synced.id, 'pec-fixture');
    const conflict = { ...await ready(), status: 'conflict' as const };
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = connection.transaction('recceSessions', 'readwrite');
      transaction.objectStore('recceSessions').put(conflict);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    await store.recoverInterruptedSyncs();
    expect((await store.getSession(draft.id))?.status).toBe('draft');
    expect((await store.getSession(pending.id))?.status).toBe('ready_to_sync');
    expect((await store.getSession(synced.id))?.status).toBe('synced');
    expect((await store.getSession(conflict.id))?.status).toBe('conflict');
  });

  it('does not change a different account stranded session', async () => {
    const email = spyOn(auth, 'getEmail').and.returnValue('other@example.test');
    const session = await ready();
    await store.markSessionSyncing(session.id);
    email.and.returnValue('driver@example.test');
    await store.recoverInterruptedSyncs();
    expect(await store.getSession(session.id)).toBeNull();
    email.and.returnValue('other@example.test');
    expect((await store.getSession(session.id))?.status).toBe('syncing');
  });

  it('protects current-runtime progress when Web Locks are unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    try {
    const session = await ready();
    let started!: () => void;
    let release!: () => void;
    const began = new Promise<void>((resolve) => started = resolve);
    const wait = new Promise<void>((resolve) => release = resolve);
    const pending = store.runSessionSync(session.id, async () => {
      started();
      await wait;
      await store.markSessionReadyToSync(session.id);
    });
    await began;
    await store.recoverInterruptedSyncs();
    expect((await store.getSession(session.id))?.status).toBe('syncing');
    expect(await store.runSessionSync(session.id, async () => undefined)).toBeFalse();
    release();
    await pending;
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'locks', descriptor);
      else Reflect.deleteProperty(navigator, 'locks');
    }
  });

  it('retains data when the response fails and retries with the same id', async () => {
    spyOn(console, 'error');
    const session = await ready();
    const pec = remote(session.id);
    pec.syncOfflineRecce.and.returnValues(throwError(() => new Error('response lost')), of(response(session.id)));
    const page = component(store, pec);
    page.sessions = await store.listSessions();
    await page.syncSession(session);
    const retained = await store.getSession(session.id);
    expect(retained?.status).toBe('ready_to_sync');
    expect(retained?.gpsTrack).toEqual(session.gpsTrack);
    expect(await (await store.getAudioBlob(session.audioBlobId!))!.text()).toBe('audio');
    expect(page.syncingSessionId).toBeNull();
    await page.syncSession(retained!);
    expect(pec.syncOfflineRecce.calls.allArgs().map(([request]) => request.sessionId)).toEqual([session.id, session.id]);
    expect(await store.getSession(session.id)).toBeNull();
  });

  it('recovers after notes arrive but audio upload fails, without replacing the session id', async () => {
    spyOn(console, 'error');
    const session = await ready();
    const pec = remote(session.id);
    pec.uploadAudio.and.returnValues(throwError(() => new Error('audio offline')),
      of({ hasVideo: false, hasAudio: true, hasGps: false }));
    const page = component(store, pec);
    page.sessions = await store.listSessions();
    await page.syncSession(session);
    const retained = await store.getSession(session.id);
    expect(retained?.status).toBe('ready_to_sync');
    expect(retained?.audioBlobId).toBe(session.audioBlobId);
    expect(await store.getAudioBlob(session.audioBlobId!)).not.toBeNull();
    await page.syncSession(retained!);
    expect(pec.syncOfflineRecce.calls.allArgs().map(([request]) => request.sessionId)).toEqual([session.id, session.id]);
    expect(await store.getSession(session.id)).toBeNull();
  });

  it('does not strand syncing on local deletion failure after a successful upload', async () => {
    spyOn(console, 'error');
    const session = await ready();
    const pec = remote(session.id);
    const deletion = spyOn(store, 'deleteSession').and.rejectWith(new Error('local deletion failed'));
    const page = component(store, pec);
    page.sessions = await store.listSessions();
    await page.syncSession(session);
    expect((await store.getSession(session.id))?.status).toBe('ready_to_sync');
    expect(page.syncingSessionId).toBeNull();
    deletion.and.callThrough();
    await page.syncSession((await store.getSession(session.id))!);
    expect(await store.getSession(session.id)).toBeNull();
    expect(pec.syncOfflineRecce.calls.allArgs().map(([request]) => request.sessionId)).toEqual([session.id, session.id]);
  });

  it('releases the live marker after an unexpected operation failure so recovery can retry', async () => {
    const session = await ready();
    await expectAsync(store.runSessionSync(session.id, async () => { throw new Error('interrupted'); })).toBeRejected();
    await store.recoverInterruptedSyncs();
    expect((await store.getSession(session.id))?.status).toBe('ready_to_sync');
  });

  it('does not send a session that was deleted before the sync claim', async () => {
    const session = await ready();
    await store.deleteSession(session.id);
    const pec = remote(session.id);
    const page = component(store, pec);
    await page.syncSession(session);
    expect(pec.syncOfflineRecce).not.toHaveBeenCalled();
    expect(page.syncingSessionId).toBeNull();
  });

  it('rejects an aborted IndexedDB claim before starting HTTP', async () => {
    spyOn(console, 'error');
    const session = await ready();
    const put = IDBObjectStore.prototype.put;
    spyOn(IDBObjectStore.prototype, 'put').and.callFake(function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = key === undefined ? put.call(this, value) : put.call(this, value, key);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    const pec = remote(session.id);
    await component(store, pec).syncSession(session);
    expect(pec.syncOfflineRecce).not.toHaveBeenCalled();
    expect((await store.getSession(session.id))?.status).toBe('ready_to_sync');
  });
});
