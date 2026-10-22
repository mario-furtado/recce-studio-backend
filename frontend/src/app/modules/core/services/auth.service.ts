import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, timeout } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { SharedProperties } from '../shared/shared-properties';

export interface AuthPayload {
  email: string;
  password: string;
  teamName?: string;
  driverName?: string;
  coDriverName?: string;
  noteSystem?: string;
  distanceUnit?: string;
}

export interface AuthResponse {
  token: string;
  email: string;
  profile?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = `${API_BASE_URL}/api/auth`;
  private readonly tokenKey = 'recce_auth_token';
  private readonly emailKey = 'recce_auth_email';
  private readonly offlineToken = 'offline-session';

  constructor(
    private http: HttpClient,
    private router: Router,
    private shared: SharedProperties,
  ) {}

  login(payload: AuthPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, payload).pipe(tap((response) => this.storeSession(response)));
  }

  register(payload: AuthPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, payload).pipe(tap((response) => this.storeSession(response)));
  }

  enterOffline(): void {
    localStorage.setItem(this.tokenKey, this.offlineToken);
    localStorage.setItem(this.emailKey, 'offline@recce.local');
  }

  validate(): Observable<void> {
    return this.http.get<void>(`${this.apiUrl}/validate`);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getEmail(): string | null {
    return localStorage.getItem(this.emailKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isOfflineSession(): boolean {
    return this.getToken() === this.offlineToken;
  }

  clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.emailKey);
  }

  logout(): void {
    const token = this.getToken();
    if (!token || token === this.offlineToken) {
      this.clearSession();
      this.router.navigate(['/login']);
      return;
    }

    this.http.post<void>(`${this.apiUrl}/logout`, null, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(timeout(10000)).subscribe({
      next: () => {
        if (this.getToken() !== token) return;
        this.clearSession();
        this.router.navigate(['/login']);
      },
      error: () => {
        if (this.getToken() !== token) return;
        this.shared.error(
          'Não foi possível terminar sessão',
          'A sessão foi mantida. Verifica a ligação ao servidor e tenta novamente.',
        );
      },
    });
  }

  private storeSession(response: AuthResponse): void {
    localStorage.setItem(this.tokenKey, response.token);
    localStorage.setItem(this.emailKey, response.email);
  }
}
