import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Invitation, InvitationApi, invitationStatus } from '../../core/services/invitation-api';

@Component({
  selector: 'app-rally-invitations',
  imports: [CommonModule, FormsModule],
  template: `
    <details *ngIf="available" class="border-t border-slate-700 mt-3">
      <summary class="cursor-pointer font-bold min-h-11 py-3">Convites de leitura</summary>
      <p class="text-sm text-slate-300">Apenas este rali. O destinatário recebe o convite na aplicação após verificar o endereço.</p>
      <form class="flex flex-wrap items-end gap-3 my-3" (ngSubmit)="send()">
        <label class="management-field grow">Email do destinatário
          <input name="recipient" type="email" required maxlength="254" [(ngModel)]="email" class="themed-input rounded-lg px-3 py-2" />
        </label>
        <button type="submit" class="accent-button rounded-lg min-h-11 px-3 py-2" [disabled]="busy || !email.trim()">Enviar convite</button>
      </form>
      <p *ngIf="status" role="status">{{ status }}</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="!items.length && !busy">Ainda não enviaste convites para este rali.</p>
      <ul class="divide-y divide-slate-700">
        <li *ngFor="let item of items" class="flex flex-wrap items-center justify-between gap-3 py-2">
          <div class="min-w-0 break-all">
            <strong>{{ item.recipientEmail }}</strong>
            <p class="text-sm">{{ labels[item.state] }}<span *ngIf="item.state === 'PENDING'"> · Até {{ item.expiresAt | date:'short' }}</span></p>
          </div>
          <button *ngIf="item.state === 'PENDING'" type="button" class="soft-button rounded-lg min-h-11 px-3 py-2"
            [attr.aria-label]="'Cancelar convite para ' + item.recipientEmail" [disabled]="busy" (click)="cancel(item)">Cancelar convite</button>
        </li>
      </ul>
      <div *ngIf="page || hasMore" class="flex gap-3 mt-3">
        <button *ngIf="page" type="button" class="soft-button rounded-lg px-3 py-2" [disabled]="busy" (click)="load(page - 1)">Anterior</button>
        <button *ngIf="hasMore" type="button" class="soft-button rounded-lg px-3 py-2" [disabled]="busy" (click)="load(page + 1)">Seguinte</button>
      </div>
    </details>`,
})
export class RallyInvitationsComponent implements OnInit {
  @Input({ required: true }) rallyId!: string;
  private readonly api = inject(InvitationApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly labels = invitationStatus;
  available = false;
  busy = false;
  email = '';
  status = '';
  error = '';
  items: Invitation[] = [];
  page = 0;
  hasMore = false;

  ngOnInit() { this.load(0); }

  load(page: number) {
    this.busy = true;
    this.api.sent(this.rallyId, page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.available = true;
        this.items = result.items;
        this.page = page;
        this.hasMore = result.hasMore;
        this.busy = false;
      },
      error: () => {
        this.busy = false;
        if (this.available) this.error = 'Não foi possível atualizar os convites.';
      },
    });
  }

  send() {
    if (this.busy || !this.email.trim()) return;
    this.busy = true;
    this.error = this.status = '';
    this.api.send(this.rallyId, this.email).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.email = ''; this.status = result.message; this.load(0); },
      error: error => this.fail(error),
    });
  }

  cancel(item: Invitation) {
    if (this.busy) return;
    this.busy = true;
    this.error = this.status = '';
    this.api.cancel(this.rallyId, item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.status = 'Convite cancelado.'; this.load(this.page); },
      error: error => { this.fail(error); if (error.status === 409) this.load(this.page); },
    });
  }

  private fail(error: HttpErrorResponse) {
    this.busy = false;
    this.error = error.error?.message || 'Não foi possível concluir o pedido.';
  }
}
