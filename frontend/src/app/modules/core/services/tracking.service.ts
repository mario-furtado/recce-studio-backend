import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SharedProperties } from '../shared/shared-properties';

export interface ClickMarker {
  index: number;
  timestamp: number;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  speed: number | null;
  text?: string;
  rawText?: string;
  speedRating?: string;
  source?: 'manual' | 'voice';
  audioConfidence?: number | null;
}

export interface GpsTrackPoint {
  lat: number;
  lng: number;
  speedKmh: number;
  timestamp: number;
  accuracy?: number | null;
}

export interface GpsStatus {
  state: 'idle' | 'searching' | 'active' | 'degraded' | 'error';
  label: string;
  points: number;
  accuracy: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class TrackingService {
  private isRecording = false;
  private startTime = 0;
  private watchId: number | null = null;

  public currentCoords$ = new BehaviorSubject<{
    lat: number;
    lng: number;
    speed: number;
    accuracy: number | null;
  } | null>(null);
  public gpsStatus$ = new BehaviorSubject<GpsStatus>({
    state: 'idle',
    label: 'GPS inativo',
    points: 0,
    accuracy: null,
  });
  public markers: ClickMarker[] = [];
  public gpsTrack: GpsTrackPoint[] = [];

  private currentLat: number | null = null;
  private currentLng: number | null = null;
  private currentAlt: number | null = null;
  private currentSpeed: number | null = null;
  private currentAccuracy: number | null = null;

  constructor(private shared: SharedProperties) {}

  requestGpsAndStart(
    initialMarkers: ClickMarker[] = [],
    initialElapsedSeconds = 0,
    initialGpsTrack: GpsTrackPoint[] = [],
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        this.gpsStatus$.next({
          state: 'error',
          label: 'GPS indisponivel',
          points: 0,
          accuracy: null,
        });
        this.shared.error(
          'GPS indisponível',
          'O seu dispositivo não suporta geolocalização.',
        );
        return resolve(false);
      }

      let resolvedStart = false;
      this.initializeRecording(initialMarkers, initialElapsedSeconds, initialGpsTrack);
      this.gpsStatus$.next({
        state: 'searching',
        label: 'A procurar GPS',
        points: this.gpsTrack.length,
        accuracy: null,
      });

      const resolveStart = () => {
        if (resolvedStart) return;
        resolvedStart = true;
        resolve(true);
      };

      const startFallback = window.setTimeout(resolveStart, 6000);

      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          window.clearTimeout(startFallback);
          this.currentLat = position.coords.latitude;
          this.currentLng = position.coords.longitude;
          this.currentAlt = position.coords.altitude;
          this.currentSpeed = position.coords.speed
            ? position.coords.speed * 3.6
            : 0;
          this.currentAccuracy = position.coords.accuracy ?? null;

          this.currentCoords$.next({
            lat: this.currentLat,
            lng: this.currentLng,
            speed: this.currentSpeed,
            accuracy: this.currentAccuracy,
          });

          this.recordGpsPoint();
          this.updateGpsStatus('active', this.currentAccuracy);
          resolveStart();
        },
        (error) => {
          console.error('Erro ao aceder ao GPS:', error);
          window.clearTimeout(startFallback);
          if (error.code === error.PERMISSION_DENIED) {
            this.gpsStatus$.next({
              state: 'error',
              label: 'GPS bloqueado',
              points: this.gpsTrack.length,
              accuracy: null,
            });
            this.shared.error(
              'Permissão de GPS necessaria',
              'Autorize o GPS para gravar o traçado do reconhecimento.',
            );
            resolve(false);
            return;
          }

          this.updateGpsStatus('degraded', null);
          resolveStart();
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 30000,
        },
      );
    });
  }

  registerClick(noteData: Partial<ClickMarker> = {}): ClickMarker | null {
    if (!this.isRecording) return null;

    const elapsedSeconds = parseFloat(
      ((Date.now() - this.startTime) / 1000).toFixed(2),
    );

    const newMarker: ClickMarker = {
      index: this.markers.length + 1,
      timestamp: elapsedSeconds,
      latitude: this.currentLat,
      longitude: this.currentLng,
      altitude: this.currentAlt,
      speed: this.currentSpeed,
      text: noteData.text,
      rawText: noteData.rawText,
      speedRating: noteData.speedRating,
      source: noteData.source || 'manual',
      audioConfidence: noteData.audioConfidence ?? null,
    };

    this.markers.push(newMarker);
    return newMarker;
  }

  updateMarker(
    index: number,
    noteData: Partial<ClickMarker>,
  ): ClickMarker | null {
    const marker = this.markers.find((item) => item.index === index);
    if (!marker) return null;

    Object.assign(marker, {
      text: noteData.text ?? marker.text,
      rawText: noteData.rawText ?? marker.rawText,
      speedRating: noteData.speedRating ?? marker.speedRating,
      source: noteData.source ?? marker.source,
      audioConfidence: noteData.audioConfidence ?? marker.audioConfidence,
    });

    return marker;
  }

  stopRecce(): ClickMarker[] {
    this.isRecording = false;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.gpsStatus$.next({
      state: 'idle',
      label: 'GPS parado',
      points: this.gpsTrack.length,
      accuracy: this.currentAccuracy,
    });
    return this.markers;
  }

  getGpsTrack(): GpsTrackPoint[] {
    return this.gpsTrack.map((point) => ({ ...point }));
  }

  private recordGpsPoint(): void {
    if (
      !this.isRecording ||
      this.currentLat === null ||
      this.currentLng === null
    )
      return;

    const timestamp = parseFloat(
      ((Date.now() - this.startTime) / 1000).toFixed(2),
    );
    const lastPoint = this.gpsTrack[this.gpsTrack.length - 1];
    if (lastPoint && Math.abs(lastPoint.timestamp - timestamp) < 1) return;

    this.gpsTrack.push({
      lat: this.currentLat,
      lng: this.currentLng,
      speedKmh: this.currentSpeed || 0,
      timestamp,
      accuracy: this.currentAccuracy,
    });
    this.updateGpsStatus('active', this.currentAccuracy);
  }

  private initializeRecording(
    initialMarkers: ClickMarker[],
    initialElapsedSeconds: number,
    initialGpsTrack: GpsTrackPoint[],
  ): void {
    this.isRecording = true;
    this.startTime = Date.now() - Math.max(0, initialElapsedSeconds) * 1000;
    this.markers = initialMarkers.map((marker) => ({ ...marker }));
    this.gpsTrack = initialGpsTrack.map((point) => ({ ...point }));
    this.currentLat = null;
    this.currentLng = null;
    this.currentAlt = null;
    this.currentSpeed = null;
    this.currentAccuracy = null;
    this.currentCoords$.next(null);
  }

  private updateGpsStatus(
    state: 'active' | 'degraded',
    accuracy: number | null,
  ): void {
    this.gpsStatus$.next({
      state,
      label: state === 'active' ? 'GPS ativo' : 'GPS fraco',
      points: this.gpsTrack.length,
      accuracy,
    });
  }
}
