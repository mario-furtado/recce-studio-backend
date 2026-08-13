import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SharedProperties } from '../../shared-properties';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly collapsedKey = 'recce_sidebar_collapsed';

  isCollapsed = localStorage.getItem(this.collapsedKey) === 'true';
  isQuickPanelOpen = false;
  isSwitchingConnectionMode = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    public shared: SharedProperties,
  ) {}

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem(this.collapsedKey, String(this.isCollapsed));
  }

  logout(): void {
    this.auth.logout();
  }

  toggleQuickPanel(): void {
    this.isQuickPanelOpen = !this.isQuickPanelOpen;
  }

  toggleConnectionMode(): void {
    if (this.isSwitchingConnectionMode) return;

    if (this.shared.connectionMode$.value === 'online') {
      this.shared.setConnectionMode('offline');
      this.router.navigate(['/recce-mode']);
      return;
    }

    this.switchToOnline();
  }

  private switchToOnline(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.shared.error(
        'Sem ligação a internet',
        'Continua em modo offline ate o dispositivo voltar a ter rede.',
      );
      return;
    }

    if (this.auth.isOfflineSession()) {
      this.auth.clearSession();
      this.shared.setConnectionMode('online', { silent: true });
      this.isQuickPanelOpen = false;
      this.shared.info(
        'Inicia sessao online',
        'A sessao offline fica no dispositivo. Entra para sincronizar com o backend.',
      );
      this.router.navigate(['/login']);
      return;
    }

    this.isSwitchingConnectionMode = true;
    this.shared.info('A validar ligação', 'A confirmar sessão com o backend.');

    this.auth.validate().subscribe({
      next: () => {
        this.shared.setConnectionMode('online');
        this.isQuickPanelOpen = false;
        this.isSwitchingConnectionMode = false;
        this.router.navigate(['/offline-recces']);
      },
      error: (error: HttpErrorResponse) => {
        this.isSwitchingConnectionMode = false;
        if (error.status === 401) {
          this.shared.error(
            'Sessão online necessária',
            'Entra novamente para sincronizar com o backend.',
          );
          this.auth.logout();
          return;
        }
        this.shared.error(
          'Backend indisponível',
          'Continua em modo offline e tenta voltar a online mais tarde.',
        );
      },
    });
  }
}
