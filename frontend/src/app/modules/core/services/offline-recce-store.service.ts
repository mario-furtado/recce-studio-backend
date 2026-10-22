import { Injectable } from '@angular/core';
import { ClickMarker, GpsTrackPoint } from './tracking.service';
import { AuthService } from './auth.service';

export type OfflineRecceStatus = 'draft' | 'ready_to_sync' | 'syncing' | 'synced' | 'conflict';

export interface OfflineRecceSession {
  id: string;
  deviceId: string;
  userEmail: string | null;
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
  private readonly dbVersion = 1;
  private readonly sessionsStore = 'recceSessions';
  private readonly audioStore = 'recceAudio';
  private readonly deviceIdKey = 'recce_device_id';
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly activeSyncs = new Set<string>();

  constructor(private auth: AuthService) {}

  async createSession(input: CreateOfflineSessionInput): Promise<OfflineRecceSession> {
    const now = new Date().toISOString();
    const session: OfflineRecceSession = {
      id: this.createId('offline-recce'),
      deviceId: this.getDeviceId(),
      userEmail: this.requireOwner(),
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

    await this.putSession(nextSession);
    return nextSession;
  }

  async completeSession(
    sessionId: string,
    markers: ClickMarker[],
    audioBlob: Blob | null,
    gpsTrack: GpsTrackPoint[] = [],
  ): Promise<OfflineRecceSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const now = new Date().toISOString();
    let audioBlobId = session.audioBlobId;
    let audioMimeType = session.audioMimeType;
    let audioSize = session.audioSize;

    if (audioBlob) {
      audioBlobId = this.createId('audio');
      audioMimeType = audioBlob.type || 'audio/webm';
      audioSize = audioBlob.size;
      await this.putAudio({
        id: audioBlobId,
        sessionId,
        blob: audioBlob,
        mimeType: audioMimeType,
        size: audioSize,
        createdAt: now,
      });
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

    await this.putSession(completed);
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

  async deleteSession(id: string): Promise<void> {
    const session = await this.getSession(id);
    if (!session) throw new Error('Sessão indisponível para esta conta.');
    await this.writeSession(session, false, true);
  }

  async markSessionSyncing(id: string): Promise<OfflineRecceSession | null> {
    const session = await this.getSession(id);
    if (!session || session.status !== 'ready_to_sync') return null;

    const nextSession: OfflineRecceSession = {
      ...session,
      status: 'syncing',
      updatedAt: new Date().toISOString(),
      syncError: undefined,
    };

    await this.putSession(nextSession);
    return nextSession;
  }

  async runSessionSync(id: string, operation: (session: OfflineRecceSession) => Promise<void>): Promise<boolean> {
    const result = await this.withSyncLock(id, async () => {
      this.activeSyncs.add(id);
      try {
        const session = await this.markSessionSyncing(id);
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
      if (session.status !== 'syncing' || !this.sameOwner(session.userEmail, owner)) continue;
      await this.withSyncLock(session.id, async () => {
        const db = await this.openDb();
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(this.sessionsStore, 'readwrite');
          const store = transaction.objectStore(this.sessionsStore);
          const request = store.get(session.id);
          request.onsuccess = () => {
            const current = request.result as OfflineRecceSession | undefined;
            if (current?.status === 'syncing' && !this.activeSyncs.has(current.id)
              && this.sameOwner(current.userEmail, owner) && this.sameOwner(this.currentOwner(), owner)) {
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

  private sameOwner(left: string | null, right: string | null): boolean {
    return !!left?.trim() && !!right?.trim() && left.trim().toLowerCase() === right.trim().toLowerCase();
  }

  canAccessSession(session: OfflineRecceSession): boolean {
    return this.sameOwner(session.userEmail, this.currentOwner());
  }

  private currentOwner(): string | null {
    if (!this.auth.isAuthenticated()) return null;
    const email = this.auth.getEmail()?.trim().toLowerCase();
    if (!email || (email === 'offline@recce.local') !== this.auth.isOfflineSession()) return null;
    return email;
  }

  private requireOwner(): string {
    const owner = this.currentOwner();
    if (!owner) throw new Error('Inicia sessão ou entra explicitamente em modo offline.');
    return owner;
  }

  async markSessionReadyToSync(id: string, syncError?: string): Promise<OfflineRecceSession | null> {
    const session = await this.getSession(id);
    if (!session) return null;

    const nextSession: OfflineRecceSession = {
      ...session,
      status: 'ready_to_sync',
      updatedAt: new Date().toISOString(),
      syncError,
    };

    await this.putSession(nextSession);
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

  private async writeSession(session: OfflineRecceSession, create: boolean, remove = false): Promise<void> {
    const owner = this.requireOwner();
    if (!this.sameOwner(session.userEmail, owner)) throw new Error('Sessão indisponível para esta conta.');
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([this.sessionsStore, this.audioStore], 'readwrite');
      const sessions = transaction.objectStore(this.sessionsStore);
      const request = sessions.get(session.id);
      request.onsuccess = () => {
        const stored = request.result as OfflineRecceSession | undefined;
        if (!this.sameOwner(this.currentOwner(), owner)
          || (create ? !!stored : !stored || !this.sameOwner(stored.userEmail, owner))) {
          transaction.abort();
          return;
        }
        if (remove) {
          sessions.delete(session.id);
          if (stored?.audioBlobId) {
            const audio = transaction.objectStore(this.audioStore);
            const recording = audio.get(stored.audioBlobId);
            recording.onsuccess = () => {
              if ((recording.result as OfflineAudioRecord | undefined)?.sessionId === session.id) {
                audio.delete(stored.audioBlobId!);
              }
            };
          }
        } else sessions.put(session);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Sessão indisponível ou transação interrompida.'));
    });
  }

  private async putAudio(audio: OfflineAudioRecord): Promise<void> {
    const session = await this.getSession(audio.sessionId);
    if (!session || !this.canAccessSession(session)) throw new Error('Sessão indisponível para esta conta.');
    await this.request<IDBValidKey>(this.audioStore, 'readwrite', (store) => store.put(audio));
  }

  private request<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const owner = this.currentOwner();
    return this.openDb().then((db) => new Promise<T>((resolve, reject) => {
      if (!this.sameOwner(owner, this.currentOwner())) {
        reject(new Error('A conta local mudou ou não está autenticada.'));
        return;
      }
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      transaction.oncomplete = () => this.sameOwner(owner, this.currentOwner())
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

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

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
