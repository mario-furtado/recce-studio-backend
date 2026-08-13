import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NewPec, Pec, Rally } from '../models/rally';
import { API_BASE_URL } from './api.config';

@Injectable({
  providedIn: 'root',
})
export class RallyService {
  private apiUrl = `${API_BASE_URL}/api/rallies`;

  constructor(private http: HttpClient) {}

  getRallies(): Observable<Rally[]> {
    return this.http.get<Rally[]>(this.apiUrl);
  }

  getRallyById(id: string): Observable<Rally> {
    return this.http.get<Rally>(`${this.apiUrl}/${id}`);
  }

  createRally(rally: Omit<Rally, 'id'>): Observable<Rally> {
    return this.http.post<Rally>(this.apiUrl, rally);
  }

  updateRally(id: string, rally: Partial<Rally>): Observable<Rally> {
    return this.http.put<Rally>(`${this.apiUrl}/${id}`, rally);
  }

  uploadRallyLogo(id: string, file: File): Observable<Rally> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Rally>(`${this.apiUrl}/${id}/logo`, formData);
  }

  getRallyLogoUrl(rally: Rally): string | null {
    return rally.logoFileName ? `${this.apiUrl}/${rally.id}/logo` : null;
  }

  deleteRally(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getRallyPecs(rallyId: string) {
    return this.http.get<any>(`${this.apiUrl}/${rallyId}/pecs`);
  }

  postRallyPec(rallyId: string, pec: NewPec) {
    return this.http.post<any>(`${this.apiUrl}/${rallyId}/pecs`, pec);
  }
}
