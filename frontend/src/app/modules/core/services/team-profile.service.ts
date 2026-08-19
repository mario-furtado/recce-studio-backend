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

  getCarPhotoBlob(carId: string, version?: string | number): Observable<Blob> {
    const query = version ? `?v=${encodeURIComponent(String(version))}` : '';
    return this.http.get(`${this.apiUrl}/cars/${carId}/photo${query}`, { responseType: 'blob' });
  }

  getCarPhotoUrl(car: TeamCar): string | null {
    if (!car.id || !car.photoFileName) {
      return null;
    }
    const version = encodeURIComponent(car.photoStoragePath || car.photoFileName);
    return `${this.apiUrl}/cars/${car.id}/photo?v=${version}`;
  }

  uploadLogo(file: File): Observable<TeamProfile> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<TeamProfile>(`${this.apiUrl}/logo`, formData);
  }

  getLogoBlob(version?: string | number): Observable<Blob> {
    const query = version ? `?v=${encodeURIComponent(String(version))}` : '';
    return this.http.get(`${this.apiUrl}/logo${query}`, { responseType: 'blob' });
  }

  toAbsoluteLogoUrl(profile: TeamProfile, version?: number | string): string | null {
    if (!profile.logoUrl) {
      return null;
    }
    const url = apiUrl(profile.logoUrl);
    return version ? `${url}?v=${encodeURIComponent(String(version))}` : url;
  }
}
