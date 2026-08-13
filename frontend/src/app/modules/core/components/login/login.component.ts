import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthPayload, AuthService } from '../../services/auth.service';
import { OfflineRecceStoreService } from '../../services/offline-recce-store.service';
import { SharedProperties } from '../../shared/shared-properties';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  isLoading = false;
  errorMessage = '';
  isBrowserOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  form: AuthPayload = {
    email: '',
    password: '',
    teamName: '',
    driverName: '',
    coDriverName: '',
    noteSystem: '1-6 (1 Lento, 6 Rapido)',
    distanceUnit: 'Quilometros (km)',
  };

  noteSystemOptions = [
    '1-6 (1 Lento, 6 Rapido)',
    '1-6 (1 Rapido, 6 Lento)',
    '1-9 (1 Lento, 9 Rapido)',
    '1-9 (1 Rapido, 9 Lento)',
    'Descritivo',
  ];

  distanceUnitOptions = ['Quilometros (km)', 'Milhas (mi)'];

  constructor(
    private auth: AuthService,
    private offlineStore: OfflineRecceStoreService,
    private router: Router,
    private shared: SharedProperties,
  ) {
    if (this.auth.isAuthenticated()) {
      if (
        this.auth.isOfflineSession() &&
        this.shared.connectionMode$.value !== 'offline'
      ) {
        this.shared.setConnectionMode('offline', { silent: true });
      }
      this.navigateAfterAuth();
    }
  }

  @HostListener('window:online')
  onOnline(): void {
    this.isBrowserOffline = false;
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.isBrowserOffline = true;
    this.errorMessage = '';
  }

  submit(): void {
    if (this.isBrowserOffline) {
      this.enterOffline();
      return;
    }

    this.errorMessage = '';
    if (!this.form.email || !this.form.password) {
      this.errorMessage = 'Preenche o email e a password.';
      return;
    }
    this.isLoading = true;
    this.auth.login(this.form).subscribe({
      next: () => {
        if (this.shared.connectionMode$.value !== 'online') {
          this.shared.setConnectionMode('online');
        }
        this.navigateAfterAuth();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Nao foi possivel autenticar. Confirma os dados e tenta novamente.';
        this.isLoading = false;
      },
    });
  }

  enterOffline(): void {
    this.shared.setConnectionMode('offline');
    this.auth.enterOffline();
    this.router.navigate(['/recce-mode']);
  }

  private async navigateAfterAuth(): Promise<void> {
    try {
      const sessions = await this.offlineStore.listSessions();
      const hasOfflineWork = sessions.some((session) => session.status !== 'synced');
      if (this.shared.connectionMode$.value === 'offline') {
        this.router.navigate([hasOfflineWork ? '/offline-recces' : '/recce-mode']);
        return;
      }
      this.router.navigate([hasOfflineWork ? '/offline-recces' : '/']);
    } catch {
      this.router.navigate([
        this.shared.connectionMode$.value === 'offline' ? '/recce-mode' : '/',
      ]);
    }
  }
}
