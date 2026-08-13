import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NewPec, Pec } from '../models/rally';
import { API_BASE_URL } from './api.config';
import { ClickMarker, GpsTrackPoint } from './tracking.service';

export interface Note {
  id?: number | string;
  originalTimestamp: number;
  text: string;
  speedRating?: string;
}

export interface PecAssets {
  hasVideo: boolean;
  videoFileName?: string;
  videoUrl?: string;
  hasGps: boolean;
  gpsFileName?: string;
  gpsUrl?: string;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  speedKmh?: number;
  timestamp?: number;
}

export interface PecPatch {
  number?: number;
  name?: string;
  distanceKm?: number;
  totalNotes?: number;
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'DRAFT' | 'PENDING_VIDEO';
}

export interface OfflineRecceSyncRequest {
  sessionId: string;
  deviceId: string;
  userEmail: string | null;
  temporaryName: string;
  pecId?: string;
  rallyId?: string;
  newPec?: NewPec;
  createdAt: string;
  finishedAt?: string;
  notesCount: number;
  durationSeconds: number;
  markers: ClickMarker[];
  gpsTrack: GpsTrackPoint[];
}

export interface OfflineRecceSyncResponse {
  syncId: string;
  offlineSessionId: string;
  pecId: string;
  pecName: string;
  notesCount: number;
  syncedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class PecService {
  private apiUrl = `${API_BASE_URL}/api/pecs`;

  constructor(private http: HttpClient) {}

  getPecById(pecId: string) {
    return this.http.get<any>(`${this.apiUrl}/${pecId}`);
  }

  updatePecById(pecId: string, pec: PecPatch) {
    return this.http.patch<Pec>(`${this.apiUrl}/${pecId}`, pec);
  }

  updatePecStatus(pecId: string, status: 'COMPLETED' | 'DRAFT') {
    return this.http.patch<any>(`${this.apiUrl}/${pecId}`, { status });
  }

  deletePecById(pecId: string) {
    return this.http.delete<any>(`${this.apiUrl}/${pecId}`);
  }

  downloadTemplate(pecId?: string): Observable<Blob> {
    const url = pecId
      ? `${this.apiUrl}/${pecId}/download-template`
      : `${this.apiUrl}/download-template`;

    return this.http.get(url, {
      responseType: 'blob',
    });
  }

  uploadNotesExcel(pecId: string, file: File): Observable<Note[]> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<Note[]>(
      `${this.apiUrl}/${pecId}/import-excel`,
      formData,
    );
  }

  getPecNotes(pecId: string): Observable<Note[]> {
    return this.http.get<Note[]>(`${this.apiUrl}/${pecId}/notes`);
  }

  saveNote(pecId: string, note: Note): Observable<Note> {
    return this.http.post<Note>(`${this.apiUrl}/${pecId}/notes`, note);
  }

  updateNote(pecId: string, noteId: string, note: Note): Observable<Note> {
    return this.http.patch<Note>(
      `${this.apiUrl}/${pecId}/notes/${noteId}`,
      note,
    );
  }

  deleteNote(pecId: string, noteId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${pecId}/notes/${noteId}`);
  }

  applyNotesOffset(pecId: string, offsetSeconds: number): Observable<Note[]> {
    return this.http.post<Note[]>(
      `${this.apiUrl}/${pecId}/notes/apply-offset`,
      { offsetSeconds },
    );
  }

  saveRecceTimestamps(pecId: string, markers: any[]) {
    return this.http.post<any>(
      `${this.apiUrl}/${pecId}/sync-timestamps`,
      markers,
    );
  }

  syncOfflineRecce(request: OfflineRecceSyncRequest): Observable<OfflineRecceSyncResponse> {
    return this.http.post<OfflineRecceSyncResponse>(
      `${API_BASE_URL}/api/offline-recces/sync`,
      request,
    );
  }

  getPecAssets(pecId: string): Observable<PecAssets> {
    return this.http.get<PecAssets>(`${this.apiUrl}/${pecId}/assets`);
  }

  uploadVideo(pecId: string, file: File): Observable<PecAssets> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<PecAssets>(`${this.apiUrl}/${pecId}/video`, formData);
  }

  deleteVideo(pecId: string): Observable<PecAssets> {
    return this.http.delete<PecAssets>(`${this.apiUrl}/${pecId}/video`);
  }

  uploadGps(pecId: string, file: File): Observable<PecAssets> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<PecAssets>(`${this.apiUrl}/${pecId}/gps`, formData);
  }

  getGpsTrack(pecId: string): Observable<GpsPoint[]> {
    return this.http.get<GpsPoint[]>(`${this.apiUrl}/${pecId}/gps/track`);
  }

  getPecRecceMarkers(pecId: string): Observable<ClickMarker[]> {
    return this.http.get<ClickMarker[]>(`${this.apiUrl}/${pecId}/gps/markers`);
  }
}
