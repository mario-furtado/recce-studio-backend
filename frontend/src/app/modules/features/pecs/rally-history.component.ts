import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { RallySummary, rallyStateLabel } from '../../core/models/rally';
import { AuthService } from '../../core/services/auth.service';
import { hasStaleCrewContext } from '../../core/services/crew-context';
import { RallyService } from '../../core/services/rally.service';
import { RallyAreaNavComponent } from './rally-area-nav.component';

type Origin = 'own' | 'shared';
type Source = { origin: Origin; label: string; rallies: RallySummary[]; loading: boolean; failed: boolean };

@Component({
  selector: 'app-rally-history',
  imports: [CommonModule, FormsModule, RouterLink, RallyAreaNavComponent],
  styleUrl: './rally-management.css',
  template: `
    <div class="rally-workspace text-white">
      <header class="glass-panel rounded-xl p-4">
        <h1 class="text-2xl font-extrabold">Histórico de ralis</h1>
        <p class="text-sm text-slate-300">Ralis concluídos ou arquivados.</p>
      </header>
      <app-rally-area-nav area="history" />
      <p *ngIf="sessionChanged" role="alert">A sessão mudou. Atualiza esta página antes de continuar.</p>
      <ng-container *ngIf="!sessionChanged">
        <div class="flex flex-wrap gap-3">
          <label class="management-field">Origem
            <select [(ngModel)]="origin" class="themed-input rounded-lg p-2">
              <option value="">Todas as origens</option>
              <option *ngIf="ownAvailable" value="own">Área de trabalho</option>
              <option value="shared">Partilhados comigo</option>
            </select>
          </label>
          <label class="management-field">Estado
            <select [(ngModel)]="state" class="themed-input rounded-lg p-2">
              <option value="">Todos os estados</option>
              <option value="completed">Concluídos</option>
              <option value="archived">Arquivados</option>
            </select>
          </label>
        </div>
        <ng-container *ngFor="let source of sources">
            <section *ngIf="!origin || origin === source.origin" [attr.aria-label]="source.label" class="space-y-2">
              <h2 class="font-bold">{{ source.label }}</h2>
              <p *ngIf="source.loading" role="status">A carregar…</p>
              <ng-container *ngIf="source.failed">
                <p role="alert">Não foi possível carregar esta origem.</p>
                <button class="soft-button rounded-lg px-3 py-2" type="button" (click)="load(source)">Tentar novamente</button>
              </ng-container>
              <ng-container *ngIf="!source.loading && !source.failed">
                <ng-container *ngIf="filtered(source) as rallies">
                  <article *ngFor="let rally of rallies" class="glass-panel rounded-xl p-3">
                    <a class="font-bold underline break-words" [routerLink]="[source.origin === 'own' ? '/rally' : '/shared-rallies', rally.id]">{{ rally.name }}</a>
                    <p class="text-sm text-slate-300">{{ label(rally) }} · {{ rally.surface }}</p>
                  </article>
                  <p *ngIf="!rallies.length" class="text-sm text-slate-300">Nenhum rali corresponde aos filtros.</p>
                </ng-container>
              </ng-container>
            </section>
        </ng-container>
      </ng-container>
    </div>
  `,
})
export class RallyHistoryComponent implements OnInit, OnDestroy {
  private readonly api = inject(RallyService);
  private readonly auth = inject(AuthService);
  private readonly session = this.auth.getToken();
  private readonly requests = new Subscription();
  readonly ownAvailable = !this.auth.isPersonalAccount() && !hasStaleCrewContext();
  readonly sources: Source[] = [
    ...(this.ownAvailable ? [{ origin: 'own' as const, label: 'Área de trabalho', rallies: [], loading: false, failed: false }] : []),
    { origin: 'shared', label: 'Partilhados comigo · Só leitura', rallies: [], loading: false, failed: false },
  ];
  readonly label = rallyStateLabel;
  origin: '' | Origin = '';
  state: '' | 'completed' | 'archived' = '';
  sessionChanged = false;

  ngOnInit() { this.sources.forEach(source => this.load(source)); }

  load(source: Source) {
    if (source.loading || this.sessionChanged) return;
    source.loading = true;
    source.failed = false;
    source.rallies = [];
    const request = source.origin === 'own' ? this.api.getRallies() : this.api.getSharedRallies();
    this.requests.add(request.subscribe({
      next: rallies => { source.rallies = rallies; source.loading = false; },
      error: () => { source.failed = true; source.loading = false; },
    }));
  }

  filtered(source: Source): RallySummary[] {
    return source.rallies.filter(rally => rally.archivedAt != null
      ? this.state !== 'completed'
      : rally.status === 'COMPLETED' && this.state !== 'archived');
  }

  @HostListener('window:storage')
  onStorage() {
    if (this.auth.getToken() === this.session) return;
    this.requests.unsubscribe();
    this.sessionChanged = true;
    this.sources.forEach(source => { source.rallies = []; });
  }

  @HostListener('document:visibilitychange')
  refreshOnReturn() {
    if (document.visibilityState === 'visible') this.sources.forEach(source => this.load(source));
  }

  ngOnDestroy() { this.requests.unsubscribe(); }
}
