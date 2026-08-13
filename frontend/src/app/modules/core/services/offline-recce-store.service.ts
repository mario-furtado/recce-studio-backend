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

  constructor(private auth: AuthService) {}

  async createSession(input: CreateOfflineSessionInput): Promise<OfflineRecceSession> {
    const now = new Date().toISOString();
    const session: OfflineRecceSession = {
      id: this.createId('offline-recce'),
      deviceId: this.getDeviceId(),
      userEmail: this.auth.getEmail(),
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

    await this.putSession(session);
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
    return this.request<OfflineRecceSession | undefined>(
      this.sessionsStore,
      'readonly',
      (store) => store.get(id),
    ).then((session) => session || null);
  }

  async listSessions(): Promise<OfflineRecceSession[]> {
    const sessions = await this.request<OfflineRecceSession[]>(
      this.sessionsStore,
      'readonly',
      (store) => store.getAll(),
    );

    return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAudioBlob(audioBlobId: string): Promise<Blob | null> {
    const audio = await this.request<OfflineAudioRecord | undefined>(
      this.audioStore,
      'readonly',
      (store) => store.get(audioBlobId),
    );

    return audio?.blob || null;
  }

  async deleteSession(id: string): Promise<void> {
    const session = await this.getSession(id);
    await this.request<undefined>(this.sessionsStore, 'readwrite', (store) => store.delete(id));
    if (session?.audioBlobId) {
      await this.request<undefined>(this.audioStore, 'readwrite', (store) => store.delete(session.audioBlobId as string));
    }
  }

  async markSessionSyncing(id: string): Promise<OfflineRecceSession | null> {
    const session = await this.getSession(id);
    if (!session) return null;

    const nextSession: OfflineRecceSession = {
      ...session,
      status: 'syncing',
      updatedAt: new Date().toISOString(),
      syncError: undefined,
    };

    await this.putSession(nextSession);
    return nextSession;
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

  private async putSession(session: OfflineRecceSession): Promise<void> {
    await this.request<IDBValidKey>(this.sessionsStore, 'readwrite', (store) => store.put(session));
  }

  private async putAudio(audio: OfflineAudioRecord): Promise<void> {
    await this.request<IDBValidKey>(this.audioStore, 'readwrite', (store) => store.put(audio));
  }

  private request<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return this.openDb().then((db) => new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
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
