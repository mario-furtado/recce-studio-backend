import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AccessEvent, InvitationApi, RallyGrant, RevocationReason } from '../../core/services/invitation-api';
import { ConfirmDialogService } from '../../core/shared/components/confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'app-rally-access',
  imports: [CommonModule, FormsModule],
  template: `
    <details *ngIf="available" class="border-t border-slate-700 mt-3">
      <summary class="cursor-pointer font-bold min-h-11 py-3">Acessos ao rali</summary>
      <p class="text-sm text-slate-300">Concessões de leitura deste rali.</p>
      <p *ngIf="status" role="status">{{ status }}</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="!grants.length && !busy">Sem concessões nesta página.</p>
      <label *ngIf="hasActive" class="flex flex-col gap-1 max-w-xs mt-3 text-sm">Motivo da revogação
        <select [(ngModel)]="reason" class="themed-input rounded-lg min-h-11 px-3 py-2">
          <option [ngValue]="null">Seleciona um motivo</option>
          <option *ngFor="let item of reasonOptions" [ngValue]="item">{{ reasons[item] }}</option>
        </select>
      </label>
      <ul class="divide-y divide-slate-700">
        <li *ngFor="let grant of grants" class="flex flex-wrap items-center justify-between gap-3 py-2">
          <div class="min-w-0 break-all">
            <strong>{{ grant.recipientEmail }}</strong>
            <p class="text-sm">{{ grant.active ? 'READ ativo' : 'Acesso revogado' }}<span *ngIf="grant.revocationReason"> · {{ reasons[grant.revocationReason] }}</span></p>
          </div>
          <button *ngIf="grant.active" type="button" [disabled]="busy || !reason" (click)="revoke(grant)"
            [attr.aria-label]="'Revogar acesso de ' + grant.recipientEmail" class="danger-button rounded-lg min-h-11 px-3 py-2">Revogar acesso</button>
        </li>
      </ul>
      <div *ngIf="page || hasMore" class="flex gap-2">
        <button *ngIf="page" type="button" [disabled]="busy" (click)="load(page - 1)" class="soft-button rounded-lg min-h-11 px-3">Acessos anteriores</button>
        <button *ngIf="hasMore" type="button" [disabled]="busy" (click)="load(page + 1)" class="soft-button rounded-lg min-h-11 px-3">Mais acessos</button>
      </div>
      <details class="mt-3" (toggle)="openHistory($event)">
        <summary class="cursor-pointer font-bold min-h-11 py-3">Histórico de acessos</summary>
        <p *ngIf="historyError" role="alert">{{ historyError }}</p>
        <p *ngIf="historyLoaded && !history.length">Sem eventos nesta página.</p>
        <ul class="divide-y divide-slate-700">
          <li *ngFor="let event of history" class="py-2">
            {{ actions[event.action] }} · {{ event.occurredAt | date:'short' }}
            <span *ngIf="event.reason"> · {{ reasons[event.reason] }}</span>
            <details class="text-sm text-slate-300 break-all">
              <summary>Identificadores do evento</summary>
              <p>Ator: {{ event.actorId }}</p>
              <p *ngIf="event.recipientId">Destinatário: {{ event.recipientId }}</p>
              <p *ngIf="event.invitationId">Convite: {{ event.invitationId }}</p>
              <p *ngIf="event.grantId">Concessão: {{ event.grantId }}</p>
            </details>
          </li>
        </ul>
        <button *ngIf="historyPage" type="button" (click)="loadHistory(historyPage - 1)" class="soft-button rounded-lg min-h-11 px-3">Eventos anteriores</button>
        <button *ngIf="moreHistory" type="button" (click)="loadHistory(historyPage + 1)" class="soft-button rounded-lg min-h-11 px-3">Mais eventos</button>
      </details>
    </details>`,
})
export class RallyAccessComponent implements OnInit {
  @Input({ required: true }) rallyId!: string;
  private readonly api = inject(InvitationApi);
  private readonly dialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);
  readonly reasons: Record<RevocationReason, string> = {
    COLLABORATION_ENDED: 'Fim da colaboração', SHARING_ERROR: 'Partilha por engano', OTHER: 'Outro motivo',
  };
  readonly reasonOptions = Object.keys(this.reasons) as RevocationReason[];
  readonly actions: Record<AccessEvent['action'], string> = {
    INVITED: 'Convite enviado', ACCEPTED: 'Convite aceite', DECLINED: 'Convite recusado',
    CANCELLED: 'Convite cancelado', REVOKED: 'Concessão revogada',
  };
  available = false;
  busy = false;
  reason: RevocationReason | null = null;
  grants: RallyGrant[] = [];
  history: AccessEvent[] = [];
  page = 0;
  hasMore = false;
  historyPage = 0;
  moreHistory = false;
  historyLoaded = false;
  error = '';
  historyError = '';
  status = '';

  get hasActive() { return this.grants.some(grant => grant.active); }

  ngOnInit() { this.load(0); }

  load(page: number) {
    this.busy = true;
    this.api.grants(this.rallyId, page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.available = true;
        this.grants = result.items;
        this.hasMore = result.hasMore;
        this.page = page;
        this.busy = false;
      },
      error: () => {
        this.busy = false;
        if (this.available) this.error = 'Não foi possível atualizar os acessos.';
      },
    });
  }

  openHistory(event: Event) {
    if ((event.target as HTMLDetailsElement).open) this.loadHistory(0);
  }

  loadHistory(page: number) {
    this.historyError = '';
    this.api.history(this.rallyId, page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.history = result.items;
        this.moreHistory = result.hasMore;
        this.historyPage = page;
        this.historyLoaded = true;
      },
      error: () => { this.historyError = 'Não foi possível carregar o histórico.'; },
    });
  }

  async revoke(grant: RallyGrant) {
    const reason = this.reason;
    if (this.busy || !grant.active || !reason) return;
    this.busy = true;
    this.error = this.status = '';
    const confirmed = await this.dialog.confirm({
      title: 'Revogar acesso de leitura?',
      message: `Os próximos pedidos de ${grant.recipientEmail} a este rali serão recusados.`,
      detail: 'Os ficheiros já descarregados, os dados já recebidos e os pedidos em curso podem continuar disponíveis.',
      confirmText: 'Revogar acesso',
      tone: 'danger',
    });
    if (!confirmed || this.destroyRef.destroyed) { this.busy = false; return; }
    this.api.revoke(this.rallyId, grant.id, reason).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.status = 'Acesso revogado.';
        this.reason = null;
        this.load(0);
        if (this.historyLoaded) this.loadHistory(0);
      },
      error: () => { this.error = 'Não foi possível revogar o acesso.'; this.busy = false; },
    });
  }
}
