import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Invitation, InvitationApi, invitationStatus } from '../../core/services/invitation-api';

@Component({
  selector: 'app-invitation-inbox',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="glass-panel rounded-xl p-4 max-w-3xl mx-auto">
      <a *ngIf="id" routerLink="/notifications" class="underline">Voltar às notificações</a>
      <h1 class="text-xl font-bold my-3">{{ id ? 'Convite de leitura' : 'Notificações' }}</h1>
      <p *ngIf="busy && !detail" role="status">A carregar…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <ng-container *ngIf="!id && !error">
        <p *ngIf="!busy && !items.length">Sem notificações nesta página.</p>
        <ul class="divide-y divide-slate-700">
          <li *ngFor="let item of items" class="py-3">
            <a [routerLink]="['/notifications', item.id]" class="underline font-bold">{{ item.rallyName }}</a>
            <p class="text-sm">{{ labels[item.state] }} · {{ item.read ? 'Lida' : 'Por ler' }}</p>
          </li>
        </ul>
        <div *ngIf="page || hasMore" class="flex gap-3 mt-3">
          <button *ngIf="page" type="button" class="soft-button rounded-lg px-3 py-2" [disabled]="busy" (click)="load(page - 1)">Anterior</button>
          <button *ngIf="hasMore" type="button" class="soft-button rounded-lg px-3 py-2" [disabled]="busy" (click)="load(page + 1)">Seguinte</button>
        </div>
      </ng-container>
      <ng-container *ngIf="detail as item">
        <h2 class="font-bold">{{ item.rallyName }}</h2>
        <p class="text-sm text-slate-300">De {{ item.crewName }}</p>
        <p>Apenas este rali · Só leitura</p>
        <p role="status">{{ labels[item.state] }}</p>
        <p *ngIf="item.state === 'PENDING'" class="text-sm">Válido até {{ item.expiresAt | date:'short' }}</p>
        <div class="flex flex-wrap gap-3 mt-3">
          <button *ngIf="!item.read" type="button" class="soft-button rounded-lg px-3 py-2" [disabled]="busy" (click)="act('read')">Marcar como lida</button>
          <ng-container *ngIf="item.state === 'PENDING'">
            <button type="button" class="accent-button rounded-lg px-3 py-2" [disabled]="busy" (click)="act('accept')">Aceitar convite</button>
            <button type="button" class="soft-button rounded-lg px-3 py-2" [disabled]="busy" (click)="act('decline')">Recusar convite</button>
          </ng-container>
          <a *ngIf="item.state === 'ACCEPTED'" [routerLink]="['/shared-rallies', item.rallyId]" class="soft-button rounded-lg px-3 py-2">Consultar rali</a>
        </div>
      </ng-container>
      <button *ngIf="error && !busy" type="button" class="soft-button rounded-lg px-3 py-2 mt-3" (click)="load(page)">Tentar novamente</button>
    </section>`,
})
export class InvitationInboxComponent implements OnInit, OnDestroy {
  private readonly api = inject(InvitationApi);
  private readonly route = inject(ActivatedRoute);
  private navigation?: Subscription;
  private request?: Subscription;
  readonly labels = invitationStatus;
  id = '';
  items: Invitation[] = [];
  detail?: Invitation;
  page = 0;
  hasMore = false;
  busy = true;
  error = '';

  ngOnInit() {
    this.navigation = this.route.paramMap.subscribe(params => {
      this.id = params.get('id') ?? '';
      this.detail = undefined;
      this.load(0);
    });
  }

  load(page: number, keepError = false) {
    this.request?.unsubscribe();
    this.busy = true;
    if (!keepError) this.error = '';
    const fail = () => {
      this.detail = undefined;
      this.error = 'Não foi possível abrir esta notificação.';
      this.busy = false;
    };
    if (this.id) {
      this.request = this.api.detail(this.id).subscribe({
        next: item => { this.detail = item; this.busy = false; },
        error: fail,
      });
    } else {
      this.request = this.api.received(page).subscribe({
        next: inbox => { this.items = inbox.items; this.page = page; this.hasMore = inbox.hasMore; this.busy = false; },
        error: fail,
      });
    }
  }

  act(action: 'read' | 'accept' | 'decline') {
    if (!this.detail || this.busy) return;
    this.busy = true;
    this.error = '';
    const request = action === 'read' ? this.api.markRead(this.id) : this.api.decide(this.id, action);
    this.request = request.subscribe({
      next: item => { this.detail = item; this.busy = false; this.api.refresh.next(); },
      error: error => {
        this.busy = false;
        this.error = error.error?.message || 'Não foi possível atualizar o convite.';
        if (error.status === 404 || error.status === 409) this.load(0, true);
      },
    });
  }

  ngOnDestroy() { this.navigation?.unsubscribe(); this.request?.unsubscribe(); }
}
