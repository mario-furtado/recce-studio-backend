import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { InvitationApi, ManagedRally } from '../../core/services/invitation-api';
import { RallyAccessComponent } from './rally-access.component';
import { RallyInvitationsComponent } from './rally-invitations.component';

@Component({
  selector: 'app-account-sharing',
  imports: [CommonModule, RouterLink, RallyAccessComponent, RallyInvitationsComponent],
  template: `
    <section aria-labelledby="account-sharing-title" class="glass-panel p-5 md:p-6 rounded-2xl">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="account-sharing-title" class="text-xl font-bold">Partilhas</h2>
        <a routerLink="/shared-rallies" class="underline text-sm">Partilhados comigo</a>
      </div>
      <div *ngIf="sessionChanged; else sharingList" role="alert" class="mt-3">A sessão mudou. Atualiza a página.</div>
      <ng-template #sharingList>
        <label class="inline-flex items-center gap-2 mt-3">
          <input type="checkbox" [checked]="!sharedOnly" [disabled]="loading || !!selected" (change)="toggleAll()">
          Mostrar todos os meus ralis
        </label>
        <p *ngIf="loading" role="status" class="mt-3">A carregar partilhas…</p>
        <div *ngIf="failed" class="mt-3">
          <p role="alert">Não foi possível carregar as partilhas.</p>
          <button type="button" class="soft-button rounded-lg px-3 py-2" (click)="load(requestedPage)">Tentar novamente</button>
        </div>
        <p *ngIf="!loading && !failed && !rallies.length" class="mt-3">{{ sharedOnly ? 'Sem acessos ativos ou convites pendentes.' : 'Sem ralis nesta página.' }}</p>
        <ul class="divide-y divide-slate-700 mt-2">
          <li *ngFor="let rally of rallies" class="py-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0 break-words">
                <strong>{{ rally.name }}</strong>
                <p class="text-sm text-slate-300">{{ rally.crewName }} · {{ rally.archivedAt != null ? 'Arquivado' : rally.status === 'COMPLETED' ? 'Concluído' : 'Em preparação' }}</p>
                <p class="text-sm">{{ rally.activeReaders }} acessos ativos · {{ rally.pendingInvitations }} convites pendentes</p>
              </div>
              <button type="button" class="soft-button rounded-lg min-h-11 px-3" [attr.aria-expanded]="selected?.id === rally.id"
                [attr.aria-label]="(selected?.id === rally.id ? 'Fechar partilha de ' : 'Gerir partilha de ') + rally.name"
                (click)="choose(rally)">{{ selected?.id === rally.id ? 'Fechar' : 'Gerir partilha' }}</button>
            </div>
            <div *ngIf="selected?.id === rally.id" class="mt-3">
              <app-rally-invitations [rallyId]="rally.id" [showLoadError]="true" />
              <app-rally-access [rallyId]="rally.id" [rallyName]="rally.name" [expanded]="true" />
            </div>
          </li>
        </ul>
        <div *ngIf="!failed && (page || hasMore)" class="flex gap-2 mt-3">
          <button *ngIf="page" type="button" class="soft-button rounded-lg px-3 py-2" [disabled]="loading || !!selected" (click)="load(page - 1)">Anterior</button>
          <button *ngIf="hasMore" type="button" class="soft-button rounded-lg px-3 py-2" [disabled]="loading || !!selected" (click)="load(page + 1)">Seguinte</button>
        </div>
      </ng-template>
    </section>`,
})
export class AccountSharingComponent implements OnInit {
  private readonly api = inject(InvitationApi);
  private readonly auth = inject(AuthService);
  private readonly session = this.auth.getToken();
  private readonly destroyRef = inject(DestroyRef);
  rallies: ManagedRally[] = [];
  selected?: ManagedRally;
  sharedOnly = true;
  loading = false;
  failed = false;
  sessionChanged = false;
  page = 0;
  requestedPage = 0;
  hasMore = false;

  ngOnInit() { this.load(0); }

  @HostListener('window:storage')
  checkSession() {
    if (this.auth.getToken() === this.session) return true;
    this.sessionChanged = true;
    this.rallies = [];
    this.selected = undefined;
    return false;
  }

  toggleAll() {
    this.sharedOnly = !this.sharedOnly;
    this.load(0);
  }

  choose(rally: ManagedRally) {
    if (!this.checkSession() || this.loading) return;
    if (this.selected?.id === rally.id) {
      this.selected = undefined;
      this.load(this.page);
    } else {
      this.selected = rally;
    }
  }

  load(page: number) {
    if (!this.checkSession() || this.loading) return;
    this.requestedPage = page;
    this.loading = true;
    this.failed = false;
    this.api.managedRallies(this.sharedOnly, page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.loading = false;
        if (!this.checkSession()) return;
        if (!result.items.length && page > 0) { this.load(page - 1); return; }
        this.rallies = result.items;
        this.page = page;
        this.hasMore = result.hasMore;
      },
      error: () => {
        this.loading = false;
        if (!this.checkSession()) return;
        this.rallies = [];
        this.failed = true;
      },
    });
  }
}
