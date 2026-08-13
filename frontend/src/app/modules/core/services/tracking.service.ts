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
  } | null>(null);
  public markers: ClickMarker[] = [];
  public gpsTrack: GpsTrackPoint[] = [];

  private currentLat: number | null = null;
  private currentLng: number | null = null;
  private currentAlt: number | null = null;
  private currentSpeed: number | null = null;

  constructor(private shared: SharedProperties) {}

  requestGpsAndStart(
    initialMarkers: ClickMarker[] = [],
    initialElapsedSeconds = 0,
    initialGpsTrack: GpsTrackPoint[] = [],
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        this.shared.error(
          'GPS indisponível',
          'O seu dispositivo não suporta geolocalização.',
        );
        return resolve(false);
      }

      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.currentLat = position.coords.latitude;
          this.currentLng = position.coords.longitude;
          this.currentAlt = position.coords.altitude;
          this.currentSpeed = position.coords.speed
            ? position.coords.speed * 3.6
            : 0;

          this.currentCoords$.next({
            lat: this.currentLat,
            lng: this.currentLng,
            speed: this.currentSpeed,
          });

          if (!this.isRecording) {
            this.isRecording = true;
            this.startTime =
              Date.now() - Math.max(0, initialElapsedSeconds) * 1000;
            this.markers = initialMarkers.map((marker) => ({ ...marker }));
            this.gpsTrack = initialGpsTrack.map((point) => ({ ...point }));
            resolve(true);
          }

          this.recordGpsPoint();
        },
        (error) => {
          console.error('Erro ao aceder ao GPS:', error);
          this.shared.error(
            'Permissão de GPS necessaria',
            'Autorize o GPS para iniciar a gravação.',
          );
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
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
    });
  }
}
