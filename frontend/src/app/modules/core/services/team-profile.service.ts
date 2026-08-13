import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api.config';

export interface TeamCar {
  id?: string;
  name: string;
  carClass: string;
  notes?: string;
  active?: boolean;
  photoFileName?: string;
  photoContentType?: string;
  photoStoragePath?: string;
}

export interface TeamStats {
  totalPecs: number;
  totalKm: number;
  activeEvents: number;
}

export interface TeamProfile {
  id?: string;
  name: string;
  car?: string;
  carClass?: string;
  selectedCarId?: string;
  driverName: string;
  coDriverName: string;
  noteSystem: string;
  distanceUnit: string;
  logoFileName?: string;
  logoUrl?: string;
  totalPecs?: number;
  totalKm?: number;
  activeEvents?: number;
}

@Injectable({
  providedIn: 'root',
})
export class TeamProfileService {
  private apiUrl = `${API_BASE_URL}/api/team-profile`;

  constructor(private http: HttpClient) {}

  getProfile(): Observable<TeamProfile> {
    return this.http.get<TeamProfile>(this.apiUrl);
  }

  updateProfile(profile: Partial<TeamProfile>): Observable<TeamProfile> {
    return this.http.patch<TeamProfile>(this.apiUrl, profile);
  }

  getStats(): Observable<TeamStats> {
    return this.http.get<TeamStats>(`${this.apiUrl}/stats`);
  }

  getCars(): Observable<TeamCar[]> {
    return this.http.get<TeamCar[]>(`${this.apiUrl}/cars`);
  }

  createCar(car: TeamCar): Observable<TeamCar> {
    return this.http.post<TeamCar>(`${this.apiUrl}/cars`, car);
  }

  updateCar(carId: string, car: Partial<TeamCar>): Observable<TeamCar> {
    return this.http.patch<TeamCar>(`${this.apiUrl}/cars/${carId}`, car);
  }

  selectCar(carId: string): Observable<TeamProfile> {
    return this.http.post<TeamProfile>(`${this.apiUrl}/cars/${carId}/select`, {});
  }

  deleteCar(carId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/cars/${carId}`);
  }

  uploadCarPhoto(carId: string, file: File): Observable<TeamCar> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<TeamCar>(`${this.apiUrl}/cars/${carId}/photo`, formData);
  }

  getCarPhotoUrl(car: TeamCar): string | null {
    return car.id && car.photoFileName
      ? `${this.apiUrl}/cars/${car.id}/photo`
      : null;
  }

  uploadLogo(file: File): Observable<TeamProfile> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<TeamProfile>(`${this.apiUrl}/logo`, formData);
  }

  toAbsoluteLogoUrl(profile: TeamProfile): string | null {
    return profile.logoUrl ? apiUrl(profile.logoUrl) : null;
  }
}
