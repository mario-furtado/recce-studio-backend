import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { API_BASE_URL } from '../../services/api.config';
import { AuthService } from '../../services/auth.service';
import { CrewManagerComponent } from './crew-manager.component';
import { clearCrewContext, getCrewContext, hasStaleCrewContext } from '../../services/crew-context';
import { AccountSharingComponent } from '../../../features/invitations/account-sharing.component';

@Component({
  selector: 'app-personal-account', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CrewManagerComponent, AccountSharingComponent],
  template: `<div class="max-w-3xl mx-auto space-y-4">
    <h1 class="text-2xl font-black">A minha conta</h1>
    <p *ngIf="!loaded && !error" role="status">A carregar conta…</p>
    <p *ngIf="error" role="alert">{{ error }}</p>
    <section *ngIf="loaded" aria-labelledby="security-title" class="glass-panel p-5 md:p-6 rounded-2xl">
    <h2 id="security-title" class="text-xl font-bold">Conta e segurança</h2>
    <p class="mt-2 break-all">{{ email }} <span class="text-sm text-slate-300">· {{ verified ? 'Email verificado' : 'Conta existente' }}</span></p>
    <div class="mt-4"><a routerLink="/recover-access" class="soft-button px-4 py-3 rounded-lg inline-block">Recuperar acesso</a></div>
    <details *ngIf="loaded && deactivationAvailable" class="mt-6">
      <summary class="cursor-pointer text-red-300 font-semibold">Desativar conta</summary>
      <form (ngSubmit)="deactivate()" class="mt-3 space-y-3">
        <p>A sessão termina e as tuas tripulações ficam sem edição. Os leitores autorizados mantêm acesso. Podes reativar a conta em Recuperar acesso.</p>
        <label class="block">Password atual
          <input class="themed-input block w-full rounded-lg p-3 mt-1" type="password" name="password"
            autocomplete="current-password" maxlength="512" required [(ngModel)]="password" [disabled]="deactivating">
        </label>
        <p *ngIf="deactivationError" role="alert" class="text-red-300">{{ deactivationError }}</p>
        <button class="soft-button px-4 py-3 rounded-lg" type="submit" [disabled]="deactivating || !password">Confirmar desativação</button>
      </form>
    </details>
    </section>
    <section *ngIf="loaded" aria-labelledby="subscription-title" class="glass-panel p-5 md:p-6 rounded-2xl">
      <h2 id="subscription-title" class="text-xl font-bold">Subscrição</h2>
      <p class="mt-2 text-sm text-slate-300">A gestão de subscrições ainda não está disponível.</p>
    </section>
    <app-account-sharing *ngIf="loaded && crewsEnabled" class="block" />
    <section *ngIf="loaded && !crewsEnabled" aria-labelledby="sharing-unavailable-title" class="glass-panel p-5 md:p-6 rounded-2xl">
      <h2 id="sharing-unavailable-title" class="text-xl font-bold">Partilhas</h2>
      <p class="mt-2 text-sm text-slate-300">A gestão de partilhas requer tripulações ativas nesta instância.</p>
      <p *ngIf="!hasWorkspace" class="mt-2 text-sm text-slate-300">Ainda não tens uma tripulação associada.</p>
    </section>
    <section *ngIf="loaded && (crewsEnabled || hasWorkspace || crewSelected || staleSelection)" class="glass-panel p-5 md:p-6 rounded-2xl">
      <div *ngIf="staleSelection"><p role="alert">A sessão mudou. Limpa a seleção anterior ou escolhe uma tripulação.</p><button type="button" class="soft-button rounded-lg px-4 py-3 mt-2" (click)="clearSelection()">Limpar seleção anterior</button></div>
      <p *ngIf="crewsEnabled" class="text-sm">Escolhe uma tripulação para abrir os teus ralis.</p>
      <app-crew-manager *ngIf="crewsEnabled" [transfersEnabled]="transfersEnabled" />
      <a *ngIf="hasWorkspace || crewSelected" routerLink="/pecs" class="soft-button px-4 py-3 rounded-lg inline-block mt-4">Abrir os meus ralis</a>
    </section>
    <button *ngIf="error" type="button" (click)="load()" class="soft-button px-4 py-3 rounded-lg mt-3">Tentar novamente</button>
  </div>`,
})
export class PersonalAccountComponent implements OnInit, OnDestroy {
  email = ''; verified = false; hasWorkspace = false; loaded = false; error = '';
  crewsEnabled = false;
  transfersEnabled = false;
  deactivationAvailable = false;
  deactivating = false;
  password = '';
  deactivationError = '';
  readonly crewSelected = !!getCrewContext();
  staleSelection = hasStaleCrewContext();
  clearSelection() { clearCrewContext(); location.assign('/account'); }
  private request?: Subscription;
  private deactivationRequest?: Subscription;
  constructor(private http: HttpClient, private auth: AuthService, private router: Router) {}
  ngOnInit() { this.load(); }
  load() {
    this.request?.unsubscribe(); this.error = ''; this.loaded = false;
    this.request = this.http.get<{ email: string; emailVerified: boolean; hasWorkspace: boolean; crewsEnabled?: boolean; deactivationAvailable?: boolean; crewTransfersEnabled?: boolean }>(`${API_BASE_URL}/api/auth/me`).subscribe({
      next: value => {
        this.email = value.email;
        this.verified = value.emailVerified;
        this.hasWorkspace = value.hasWorkspace;
        this.crewsEnabled = value.crewsEnabled === true;
        this.transfersEnabled = value.crewTransfersEnabled === true;
        this.deactivationAvailable = value.deactivationAvailable === true;
        this.loaded = true;
      },
      error: () => { this.error = 'Não foi possível carregar a conta. Tenta novamente.'; },
    });
  }
  deactivate() {
    if (this.deactivating || !this.password || !this.deactivationAvailable) return;
    const token = this.auth.getToken();
    const password = this.password;
    this.password = '';
    this.deactivationError = '';
    this.deactivating = true;
    this.deactivationRequest = this.http.post<void>(`${API_BASE_URL}/api/auth/deactivate`, { password }).subscribe({
      next: () => {
        this.deactivating = false;
        if (token !== this.auth.getToken()) return;
        this.auth.clearSession();
        void this.router.navigate(['/login']);
      },
      error: response => {
        this.deactivating = false;
        this.deactivationError = response.error?.message ?? 'Não foi possível desativar a conta. Tenta novamente.';
      },
    });
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
    this.deactivationRequest?.unsubscribe();
    this.password = '';
  }
}
