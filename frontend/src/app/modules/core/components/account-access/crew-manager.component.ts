import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { API_BASE_URL } from '../../services/api.config';
import { clearCrewContext, CrewContext, getCrewContext, setCrewContext } from '../../services/crew-context';

interface CrewTransfer { id: string; crewName: string; expiresAt: number }
interface TransferAction { kind: 'request' | 'cancel' | 'accept'; id: string; name: string }

@Component({
  selector: 'app-crew-manager', standalone: true, imports: [CommonModule, FormsModule],
  template: `<section class="mt-6 border-t border-white/10 pt-5" aria-labelledby="crews-title">
    <h2 id="crews-title" class="text-xl font-bold">As minhas tripulações</h2>
    <p class="text-sm text-slate-300 mt-2">Cada tripulação tem os seus ralis, viaturas e sistema base.</p>
    <p *ngIf="selected" class="mt-3">Selecionada: {{ selected.name }}</p>
    <button *ngIf="selected" type="button" class="soft-button rounded-lg px-4 py-3 mt-2" (click)="leave()">Sair da tripulação</button>
    <p *ngIf="loading" role="status" class="mt-3">A carregar tripulações…</p>
    <p *ngIf="error" role="alert" class="text-red-300 mt-3">{{ error }}</p>
    <button *ngIf="loadFailed" type="button" class="soft-button rounded-lg px-4 py-3 mt-2" (click)="load()">Tentar carregar tripulações</button>
    <p *ngIf="!loading && !loadFailed && !crews.length" class="mt-3">Para criares o teu primeiro rali, cria e abre a tua primeira tripulação. Não precisas de enviar convites.</p>
    <ul class="mt-3 space-y-2"><li *ngFor="let crew of crews" class="flex flex-wrap items-center justify-between gap-3 py-2">
      <span class="break-all">{{ crew.name }} <span class="text-sm text-slate-300">· Proprietário</span></span>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="soft-button rounded-lg px-4 py-3" (click)="open(crew)" [attr.aria-label]="'Abrir tripulação ' + crew.name">Abrir</button>
        <button *ngIf="transfersEnabled" type="button" class="soft-button rounded-lg px-4 py-3"
          (click)="chooseTransfer('request', crew.id, crew.name)" [attr.aria-label]="'Transferir tripulação ' + crew.name">Transferir</button>
      </div>
    </li></ul>
    <form (ngSubmit)="create()" class="mt-5 flex flex-wrap items-end gap-3">
      <label class="flex-1 min-w-0">Nome da nova tripulação<input name="crewName" [(ngModel)]="name" required maxlength="100" [disabled]="busy" class="themed-input w-full rounded-lg p-3 mt-1"></label>
      <button type="submit" class="accent-button rounded-lg px-4 py-3" [disabled]="busy || loading || loadFailed || !name.trim()">{{ busy ? 'A criar…' : 'Criar tripulação' }}</button>
    </form>
    <ng-container *ngIf="transfersEnabled">
      <h3 class="mt-6 font-bold">Transferências de tripulação</h3>
      <p *ngIf="transferMessage" role="status" class="mt-2">{{ transferMessage }}</p>
      <p *ngIf="transferError" role="alert" class="text-red-300 mt-2">{{ transferError }}</p>
      <button *ngIf="transferLoadFailed" type="button" class="soft-button rounded-lg px-4 py-3 mt-2" (click)="loadTransfers()">Tentar novamente</button>
      <ul class="space-y-2">
        <li *ngFor="let item of transfers" class="flex flex-wrap items-center gap-2 mt-2">
          <span>{{ item.crewName }} · Até {{ item.expiresAt | date:'shortDate' }}</span>
          <button type="button" class="soft-button rounded-lg px-4 py-3" (click)="chooseTransfer('accept', item.id, item.crewName)">Aceitar transferência</button>
        </li>
      </ul>
      <div *ngIf="transferPage || transfers.length === 20" class="flex gap-2 mt-2">
        <button *ngIf="transferPage" type="button" class="soft-button rounded-lg px-4 py-3" (click)="loadTransfers(transferPage - 1)">Anterior</button>
        <button *ngIf="transfers.length === 20" type="button" class="soft-button rounded-lg px-4 py-3" (click)="loadTransfers(transferPage + 1)">Seguinte</button>
      </div>
      <form *ngIf="transferAction as action" (ngSubmit)="submitTransfer()" class="mt-4 space-y-3">
        <h4 class="font-semibold">{{ action.name }}</h4>
        <p *ngIf="action.kind === 'request'">Se a outra pessoa aceitar, ficará responsável pela tripulação e perderás a gestão. Os ralis e os acessos de leitura mantêm-se.</p>
        <p *ngIf="action.kind === 'accept'">Ao confirmar, passas a ser responsável por esta tripulação.</p>
        <label *ngIf="action.kind === 'request'" class="block">Email do novo proprietário
          <input name="recipient" [(ngModel)]="recipient" type="email" autocomplete="off" maxlength="254" required
            class="themed-input block w-full rounded-lg p-3 mt-1" [disabled]="transferBusy">
        </label>
        <label class="block">Password atual
          <input name="transferPassword" [(ngModel)]="transferPassword" type="password" autocomplete="current-password"
            maxlength="512" required class="themed-input block w-full rounded-lg p-3 mt-1" [disabled]="transferBusy">
        </label>
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="accent-button rounded-lg px-4 py-3" [disabled]="transferBusy || !transferPassword">
            {{ action.kind === 'request' ? 'Pedir transferência' : action.kind === 'accept' ? 'Confirmar aceitação' : 'Cancelar pedido' }}
          </button>
          <button type="button" class="soft-button rounded-lg px-4 py-3" [disabled]="transferBusy" (click)="closeTransfer()">Fechar</button>
          <button *ngIf="action.kind === 'request'" type="button" class="soft-button rounded-lg px-4 py-3" [disabled]="transferBusy"
            (click)="chooseTransfer('cancel', action.id, action.name)">Cancelar transferência pendente</button>
        </div>
      </form>
    </ng-container>
  </section>`,
})
export class CrewManagerComponent implements OnInit, OnDestroy {
  @Input() transfersEnabled = false;
  crews: CrewContext[] = []; selected = getCrewContext(); name = ''; requestKey = ''; error = '';
  loading = false; loadFailed = false; busy = false;
  transfers: CrewTransfer[] = [];
  transferAction?: TransferAction;
  transferMessage = ''; transferError = ''; transferPassword = ''; recipient = '';
  transferBusy = false; transferLoadFailed = false; transferPage = 0;
  private transferList?: Subscription;
  private requests = new Subscription();
  private requestName = '';
  private readonly accountSession = localStorage.getItem('recce_auth_token');
  private sessionMatches(): boolean {
    if (localStorage.getItem('recce_auth_token') === this.accountSession) return true;
    this.crews = []; this.selected = null; this.loading = false; this.busy = false;
    this.transfers = []; this.closeTransfer(); this.transferBusy = false;
    this.error = 'A sessão mudou. Atualiza esta página antes de continuar.';
    return false;
  }
  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); if (this.transfersEnabled) this.loadTransfers(); }
  load() {
    if (!this.sessionMatches() || this.loading || this.busy) return;
    this.loading = true; this.loadFailed = false; this.error = '';
    this.requests.add(this.http.get<CrewContext[]>(`${API_BASE_URL}/api/crews`).subscribe({
      next: crews => { if (!this.sessionMatches()) return; this.crews = crews; this.loading = false; },
      error: () => { if (!this.sessionMatches()) return; this.loading = false; this.loadFailed = true; this.error = 'Não foi possível carregar as tripulações. Tenta novamente.'; },
    }));
  }
  create() {
    if (!this.sessionMatches() || this.busy || this.loading || this.loadFailed || !this.name.trim()) return;
    const name = this.name.trim();
    if (!this.requestKey || this.requestName !== name) { this.requestKey = crypto.randomUUID(); this.requestName = name; }
    this.busy = true; this.error = '';
    this.requests.add(this.http.post<CrewContext>(`${API_BASE_URL}/api/crews`, { name }, { headers: { 'Idempotency-Key': this.requestKey } }).subscribe({
      next: crew => { if (!this.sessionMatches()) return; if (!this.crews.some(c => c.id === crew.id)) this.crews.push(crew); this.name = ''; this.requestKey = ''; this.busy = false; },
      error: response => { if (!this.sessionMatches()) return; this.busy = false; this.error = response.error?.message ?? 'Não foi possível criar a tripulação. Podes repetir o pedido.'; },
    }));
  }
  open(crew: CrewContext) { if (!this.sessionMatches()) return; setCrewContext(crew); location.assign('/pecs'); }
  leave() { clearCrewContext(); location.assign('/account'); }
  loadTransfers(page = this.transferPage) {
    if (!this.sessionMatches() || !this.transfersEnabled) return;
    this.transferList?.unsubscribe();
    this.transferLoadFailed = false;
    this.transferError = '';
    this.transferList = this.http.get<CrewTransfer[]>(`${API_BASE_URL}/api/crews/transfers`, { params: { page } }).subscribe({
      next: transfers => { if (this.sessionMatches()) { this.transfers = transfers; this.transferPage = page; } },
      error: () => {
        if (!this.sessionMatches()) return;
        this.transferLoadFailed = true;
        this.transferError = 'Não foi possível carregar os pedidos de transferência.';
      },
    });
  }
  chooseTransfer(kind: TransferAction['kind'], id: string, name: string) {
    if (this.transferBusy || !this.sessionMatches()) return;
    this.closeTransfer();
    this.transferAction = { kind, id, name };
    this.transferMessage = '';
  }
  closeTransfer() {
    this.transferAction = undefined;
    this.transferPassword = ''; this.recipient = ''; this.transferError = '';
  }
  submitTransfer() {
    const action = this.transferAction;
    if (!this.sessionMatches() || !action || !this.transferPassword || this.transferBusy) return;
    const id = encodeURIComponent(action.id);
    const endpoint = action.kind === 'accept' ? `transfers/${id}/accept` : `${id}/transfer${action.kind === 'cancel' ? '/cancel' : ''}`;
    const body = action.kind === 'request' ? { email: this.recipient.trim(), password: this.transferPassword } : { password: this.transferPassword };
    if ('email' in body && !body.email) return;
    this.transferPassword = '';
    this.transferError = '';
    this.transferBusy = true;
    this.requests.add(this.http.post(`${API_BASE_URL}/api/crews/${endpoint}`, body).subscribe({
      next: () => {
        if (!this.sessionMatches()) return;
        this.transferBusy = false;
        this.closeTransfer();
        this.transferMessage = action.kind === 'accept' ? 'Transferência concluída.' : action.kind === 'cancel'
          ? 'Pedido pendente cancelado.' : 'Pedido enviado. A outra pessoa tem sete dias para aceitar.';
        if (action.kind === 'accept') { this.load(); this.loadTransfers(0); }
      },
      error: response => {
        if (!this.sessionMatches()) return;
        this.transferBusy = false;
        this.transferError = response.error?.message ?? 'Não foi possível concluir a transferência. Tenta novamente.';
      },
    }));
  }
  ngOnDestroy() { this.requests.unsubscribe(); this.transferList?.unsubscribe(); this.closeTransfer(); }
}
