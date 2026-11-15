import { Injectable } from '@angular/core';
import { ClickMarker, GpsTrackPoint } from './tracking.service';
import { AuthService } from './auth.service';
import { OfflineRecceSyncRequest } from './pecs.service';

export type OfflineDestination = Pick<OfflineRecceSyncRequest, 'pecId' | 'rallyId' | 'newPec'>;

export type OfflineRecceStatus = 'draft' | 'ready_to_sync' | 'syncing' | 'synced' | 'conflict';

export interface OfflineRecceSession {
  id: string;
  deviceId: string;
  userEmail: string | null;
  ownerAccountId?: string | null;
  crewId?: string | null;
  destination?: OfflineDestination;
  syncReceiptId?: string;
  syncLeaseUntil?: number;
  status: OfflineRecceStatus;
  temporaryName: string;
  pecId?: string;
  pecName?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  notesCount: number;
  durationSeconds: number;
  markers: ClickMarker[];
  gpsTrack: GpsTrackPoint[];
  audioBlobId?: string;
  audioMimeType?: string;
  audioSize?: number;
  syncError?: string;
}

interface OfflineAudioRecord {
  id: string;
  sessionId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface CreateOfflineSessionInput {
  pecId?: string;
  pecName?: string;
  temporaryName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineRecceStoreService {
  private readonly dbName = 'recce-studio-offline';
  private readonly dbVersion = 2;
  private readonly sessionsStore = 'recceSessions';
  private readonly audioStore = 'recceAudio';
  private readonly deviceIdKey = 'recce_device_id';
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly activeSyncs = new Set<string>();

  constructor(private auth: AuthService) {}

  async createSession(input: CreateOfflineSessionInput): Promise<OfflineRecceSession> {
    const now = new Date().toISOString();
    this.requireOwner();
    const identity = this.auth.getOfflineIdentity();
    if (identity && !identity.crewId) throw new Error('Escolhe uma tripulação antes de começar o reconhecimento.');
    const session: OfflineRecceSession = {
      id: this.createId('offline-recce'),
      deviceId: this.getDeviceId(),
      userEmail: this.auth.getEmail()?.trim().toLowerCase() ?? null,
      ownerAccountId: identity?.accountId ?? null,
      crewId: identity?.crewId ?? null,
      status: 'draft',
      temporaryName: input.temporaryName || this.defaultSessionName(input.pecName),
      pecId: input.pecId,
      pecName: input.pecName,
      createdAt: now,
      updatedAt: now,
      notesCount: 0,
      durationSeconds: 0,
      markers: [],
      gpsTrack: [],
    };

    await this.putSession(session, true);
    return session;
  }

  async saveSnapshot(sessionId: string, markers: ClickMarker[], gpsTrack: GpsTrackPoint[] = []): Promise<OfflineRecceSession | null> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== 'draft') return session;

    const nextSession: OfflineRecceSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      notesCount: markers.length,
      durationSeconds: this.getDurationSeconds(markers),
      markers: this.cloneMarkers(markers),
      gpsTrack: this.cloneGpsTrack(gpsTrack),
    };

    await this.writeSession(nextSession, false, false, 'draft');
    return nextSession;
  }

  async completeSession(
    sessionId: string,
    markers: ClickMarker[],
    audioBlob: Blob | null,
    gpsTrack: GpsTrackPoint[] = [],
  ): Promise<OfflineRecceSession | null> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== 'draft') return null;

    const now = new Date().toISOString();
    let audioBlobId = session.audioBlobId;
    let audioMimeType = session.audioMimeType;
    let audioSize = session.audioSize;

    let recording: OfflineAudioRecord | undefined;
    if (audioBlob) {
      audioBlobId = this.createId('audio');
      audioMimeType = audioBlob.type || 'audio/webm';
      audioSize = audioBlob.size;
      recording = {
        id: audioBlobId,
        sessionId,
        blob: audioBlob,
        mimeType: audioMimeType,
        size: audioSize,
        createdAt: now,
      };
    }

    const completed: OfflineRecceSession = {
      ...session,
      status: 'ready_to_sync',
      updatedAt: now,
      finishedAt: now,
      notesCount: markers.length,
      durationSeconds: this.getDurationSeconds(markers),
      markers: this.cloneMarkers(markers),
      gpsTrack: this.cloneGpsTrack(gpsTrack),
      audioBlobId,
      audioMimeType,
      audioSize,
    };

    await this.writeSession(completed, false, false, 'draft', recording);
    return completed;
  }

  async getSession(id: string): Promise<OfflineRecceSession | null> {
    if (!this.currentOwner()) return null;
    return this.request<OfflineRecceSession | undefined>(
      this.sessionsStore,
      'readonly',
      (store) => store.get(id),
    ).then((session) => session && this.canAccessSession(session) ? session : null);
  }

  async listSessions(): Promise<OfflineRecceSession[]> {
    if (!this.currentOwner()) return [];
    const sessions = await this.request<OfflineRecceSession[]>(
      this.sessionsStore,
      'readonly',
      (store) => store.getAll(),
    );

    return sessions.filter((session) => this.canAccessSession(session))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAudioBlob(audioBlobId: string): Promise<Blob | null> {
    if (!this.currentOwner()) return null;
    const audio = await this.request<OfflineAudioRecord | undefined>(
      this.audioStore,
      'readonly',
      (store) => store.get(audioBlobId),
    );

    if (!audio) return null;
    const session = await this.getSession(audio.sessionId);
    return session?.audioBlobId === audioBlobId && this.canAccessSession(session) ? audio.blob : null;
  }

  async deleteSession(id: string, sync?: { session: OfflineRecceSession; token: string }): Promise<void> {
    const session = await this.getSession(id);
    if (!session) throw new Error('Sessão indisponível para esta conta.');
    if (!sync && session.status === 'syncing') throw new Error('Aguarda a conclusão da sincronização.');
    if (sync) this.requireSyncContext(sync.session, sync.token);
    await this.writeSession(session, false, true, session.status, undefined, sync?.session, sync?.token);
  }

  async markSessionSyncing(id: string, target?: OfflineDestination, leaseUntil?: number): Promise<OfflineRecceSession | null> {
    const session = await this.getSession(id);
    if (!session || session.status !== 'ready_to_sync') return null;
    if (target && ((session.pecId && session.pecId !== target.pecId)
        || (session.destination && JSON.stringify(session.destination) !== JSON.stringify(target)))) {
      throw new Error('Repete a sincronização para o destino original.');
    }

    const nextSession: OfflineRecceSession = {
      ...session,
      status: 'syncing',
      updatedAt: new Date().toISOString(),
      syncError: undefined,
      destination: session.destination ?? target,
      syncLeaseUntil: leaseUntil,
    };

    await this.writeSession(nextSession, false, false, 'ready_to_sync');
    return nextSession;
  }

  async runSessionSync(id: string, operation: (session: OfflineRecceSession) => Promise<void>, target?: OfflineDestination): Promise<boolean> {
    const result = await this.withSyncLock(id, async () => {
      this.activeSyncs.add(id);
      try {
        const lease = navigator.locks ? undefined : Date.now() + 120_000;
        const session = await this.markSessionSyncing(id, target, lease);
        if (!session || !this.canAccessSession(session)) return false;
        await operation(session);
        return true;
      } finally {
        this.activeSyncs.delete(id);
      }
    });
    return result === true;
  }

  async recoverInterruptedSyncs(): Promise<void> {
    const owner = this.currentOwner();
    if (!owner) return;
    for (const session of await this.listSessions()) {
      if (session.status !== 'syncing') continue;
      await this.withSyncLock(session.id, async () => {
        const db = await this.openDb();
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(this.sessionsStore, 'readwrite');
          const store = transaction.objectStore(this.sessionsStore);
          const request = store.get(session.id);
          request.onsuccess = () => {
            const current = request.result as OfflineRecceSession | undefined;
            if (current?.status === 'syncing' && !this.activeSyncs.has(current.id)
              && (current.syncLeaseUntil ?? 0) <= Date.now()
              && this.canAccessSession(current) && this.currentOwner() === owner) {
              store.put({ ...current, status: 'ready_to_sync', updatedAt: new Date().toISOString(),
                syncError: 'A sincronização foi interrompida. Tenta novamente.' });
            }
          };
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error || new Error('Recuperação interrompida.'));
        });
      });
    }
  }

  private async withSyncLock<T>(id: string, operation: () => Promise<T>): Promise<T | undefined> {
    if (this.activeSyncs.has(id)) return undefined;
    if (navigator.locks) {
      return navigator.locks.request(`recce-studio-offline:sync:${id}`, { ifAvailable: true },
        (lock) => lock ? operation() : undefined);
    }
    return operation();
  }

  canAccessSession(session: OfflineRecceSession): boolean {
    const owner = this.currentOwner();
    if (!owner) return false;
    if (this.auth.isOfflineSession()) {
      return session.ownerAccountId == null && session.userEmail === 'offline@recce.local';
    }
    return !!session.ownerAccountId && owner === JSON.stringify([session.ownerAccountId, session.crewId ?? null]);
  }

  requireSyncContext(session: OfflineRecceSession, expectedToken?: string): string {
    const token = this.auth.getToken();
    if (!token || (expectedToken !== undefined && token !== expectedToken)
        || !session.ownerAccountId || !session.crewId || !this.canAccessSession(session)) {
      throw new Error('Volta à conta e à tripulação originais para sincronizar esta sessão.');
    }
    if (session.status === 'syncing' && session.syncLeaseUntil && session.syncLeaseUntil <= Date.now()) {
      throw new Error('O tempo da sincronização terminou. Repete o envio.');
    }
    return token;
  }

  async rememberReceipt(attempt: OfflineRecceSession, token: string, receiptId: string): Promise<void> {
    const session = await this.getSession(attempt.id);
    if (!session || (session.syncReceiptId && session.syncReceiptId !== receiptId)) {
      throw new Error('O recibo não corresponde à sessão local.');
    }
    await this.writeSession({ ...session, syncReceiptId: receiptId }, false, false, 'syncing', undefined, attempt, token);
  }

  captureContext(): string | null {
    const owner = this.currentOwner();
    if (!owner || (!this.auth.isOfflineSession() && !this.auth.getOfflineIdentity()?.crewId)) return null;
    return JSON.stringify([owner, this.auth.getToken()]);
  }

  private currentOwner(): string | null {
    if (!this.auth.isAuthenticated()) return null;
    if (this.auth.isOfflineSession()) return 'offline';
    const identity = this.auth.getOfflineIdentity();
    return identity ? JSON.stringify([identity.accountId, identity.crewId]) : null;
  }

  private requireOwner(): string {
    const owner = this.currentOwner();
    if (!owner) throw new Error('Volta a iniciar sessão para confirmar a tua conta, ou entra em modo offline.');
    return owner;
  }

  async markSessionReadyToSync(id: string, syncError?: string, attempt?: OfflineRecceSession): Promise<OfflineRecceSession | null> {
    const session = await this.getSession(id);
    if (!session) return null;

    const nextSession: OfflineRecceSession = {
      ...session,
      status: 'ready_to_sync',
      updatedAt: new Date().toISOString(),
      syncError,
      syncLeaseUntil: undefined,
    };

    await this.writeSession(nextSession, false, false, attempt ? 'syncing' : undefined, undefined, attempt);
    return nextSession;
  }

  async markSessionSynced(id: string, pecId: string, pecName?: string): Promise<OfflineRecceSession | null> {
    const session = await this.getSession(id);
    if (!session) return null;

    const nextSession: OfflineRecceSession = {
      ...session,
      status: 'synced',
      pecId,
      pecName: pecName || session.pecName,
      updatedAt: new Date().toISOString(),
      syncError: undefined,
    };

    await this.putSession(nextSession);
    return nextSession;
  }

  getDeviceId(): string {
    const existing = localStorage.getItem(this.deviceIdKey);
    if (existing) return existing;

    const deviceId = this.createId('device');
    localStorage.setItem(this.deviceIdKey, deviceId);
    return deviceId;
  }

  private async putSession(session: OfflineRecceSession, create = false): Promise<void> {
    await this.writeSession(session, create);
  }

  private async writeSession(session: OfflineRecceSession, create: boolean, remove = false,
      expectedStatus?: OfflineRecceStatus, recording?: OfflineAudioRecord,
      attempt?: OfflineRecceSession, token?: string): Promise<void> {
    const owner = this.requireOwner();
    if (!this.canAccessSession(session)) throw new Error('Sessão indisponível para esta conta.');
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([this.sessionsStore, this.audioStore], 'readwrite');
      const sessions = transaction.objectStore(this.sessionsStore);
      const request = sessions.get(session.id);
      request.onsuccess = () => {
        const stored = request.result as OfflineRecceSession | undefined;
        if (this.currentOwner() !== owner
          || (create ? !!stored : !stored || !this.canAccessSession(stored))
          || (attempt && (stored?.syncLeaseUntil !== attempt.syncLeaseUntil || stored?.updatedAt !== attempt.updatedAt))
          || (token !== undefined && token !== this.auth.getToken())
          || (expectedStatus && stored?.status !== expectedStatus)) {
          transaction.abort();
          return;
        }
        if (remove) {
          sessions.delete(session.id);
          if (stored?.audioBlobId) {
            const audio = transaction.objectStore(this.audioStore);
            const recording = audio.get(stored.audioBlobId);
            recording.onsuccess = () => {
              if (owner !== this.currentOwner() || (token !== undefined && token !== this.auth.getToken())) {
                transaction.abort();
                return;
              }
              if ((recording.result as OfflineAudioRecord | undefined)?.sessionId === session.id) {
                audio.delete(stored.audioBlobId!);
              }
            };
          }
        } else {
          if (recording) transaction.objectStore(this.audioStore).put(recording);
          sessions.put(session);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Sessão indisponível ou transação interrompida.'));
    });
  }

  private request<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const owner = this.currentOwner();
    return this.openDb().then((db) => new Promise<T>((resolve, reject) => {
      if (!owner || owner !== this.currentOwner()) {
        reject(new Error('A conta local mudou ou não está autenticada.'));
        return;
      }
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      transaction.oncomplete = () => owner === this.currentOwner()
        ? resolve(request.result) : reject(new Error('A conta local mudou.'));
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transação local interrompida.'));
    }));
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB indisponivel neste dispositivo.'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);
      let blocked = false;
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Fecha as outras janelas da aplicação para atualizar o armazenamento offline.'));
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.sessionsStore)) {
          const sessions = db.createObjectStore(this.sessionsStore, { keyPath: 'id' });
          sessions.createIndex('status', 'status', { unique: false });
          sessions.createIndex('createdAt', 'createdAt', { unique: false });
          sessions.createIndex('pecId', 'pecId', { unique: false });
        }
        if (!db.objectStoreNames.contains(this.audioStore)) {
          const audio = db.createObjectStore(this.audioStore, { keyPath: 'id' });
          audio.createIndex('sessionId', 'sessionId', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        db.onversionchange = () => { db.close(); this.dbPromise = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });

    this.dbPromise = this.dbPromise.catch(error => { this.dbPromise = null; throw error; });
    return this.dbPromise;
  }

  private defaultSessionName(pecName?: string): string {
    const stamp = new Date().toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    return pecName ? `${pecName} - offline ${stamp}` : `Reconhecimento Offline - ${stamp}`;
  }

  private cloneMarkers(markers: ClickMarker[]): ClickMarker[] {
    return markers.map((marker) => ({ ...marker }));
  }

  private cloneGpsTrack(gpsTrack: GpsTrackPoint[]): GpsTrackPoint[] {
    return gpsTrack.map((point) => ({ ...point }));
  }

  private getDurationSeconds(markers: ClickMarker[]): number {
    if (markers.length === 0) return 0;
    return markers[markers.length - 1].timestamp || 0;
  }

  private createId(prefix: string): string {
    const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${randomId}`;
  }
}
