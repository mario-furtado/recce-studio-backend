import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { API_BASE_URL } from '../../services/api.config';
import { CrewManagerComponent } from './crew-manager.component';
import { clearCrewContext, hasStaleCrewContext } from '../../services/crew-context';

@Component({
  selector: 'app-personal-account', standalone: true, imports: [CommonModule, RouterLink, CrewManagerComponent],
  template: `<section class="glass-panel p-6 rounded-2xl max-w-3xl mx-auto">
    <h1 class="text-2xl font-black mb-4">A minha conta</h1>
    <p *ngIf="!loaded && !error" role="status">A carregar conta…</p>
    <p *ngIf="error" role="alert">{{ error }}</p>
    <ng-container *ngIf="loaded"><p>{{ email }}</p><p class="mt-3">{{ verified ? 'Email verificado' : 'Conta existente' }}</p>
    <p *ngIf="!hasWorkspace && !crewsEnabled" class="mt-4">Ainda não tens uma tripulação associada.</p>
    <p *ngIf="crewsEnabled" class="mt-4">Escolhe uma tripulação para abrir os teus ralis.</p>
    <a *ngIf="hasWorkspace" routerLink="/pecs" class="soft-button px-4 py-3 rounded-lg inline-block mt-4">Abrir os meus ralis</a></ng-container>
    <div *ngIf="staleSelection" class="mt-4"><p role="alert">A sessão mudou. Limpa a seleção anterior ou escolhe uma tripulação.</p><button type="button" class="soft-button rounded-lg px-4 py-3 mt-2" (click)="clearSelection()">Limpar seleção anterior</button></div>
    <app-crew-manager *ngIf="loaded && crewsEnabled"></app-crew-manager>
    <div class="mt-6"><a routerLink="/recover-access" class="soft-button px-4 py-3 rounded-lg inline-block">Recuperar acesso</a></div>
    <button *ngIf="error" type="button" (click)="load()" class="soft-button px-4 py-3 rounded-lg mt-3">Tentar novamente</button>
  </section>`,
})
export class PersonalAccountComponent implements OnInit, OnDestroy {
  email = ''; verified = false; hasWorkspace = false; loaded = false; error = '';
  crewsEnabled = false;
  staleSelection = hasStaleCrewContext();
  clearSelection() { clearCrewContext(); location.assign('/account'); }
  private request?: Subscription;
  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); }
  load() {
    this.request?.unsubscribe(); this.error = ''; this.loaded = false;
    this.request = this.http.get<{ email: string; emailVerified: boolean; hasWorkspace: boolean; crewsEnabled?: boolean }>(`${API_BASE_URL}/api/auth/me`).subscribe({
      next: value => { this.email = value.email; this.verified = value.emailVerified; this.hasWorkspace = value.hasWorkspace; this.crewsEnabled = value.crewsEnabled === true; this.loaded = true; },
      error: () => { this.error = 'Não foi possível carregar a conta. Tenta novamente.'; },
    });
  }
  ngOnDestroy() { this.request?.unsubscribe(); }
}
