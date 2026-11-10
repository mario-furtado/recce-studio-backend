import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { API_BASE_URL } from '../../services/api.config';
import { clearCrewContext, CrewContext, getCrewContext, setCrewContext } from '../../services/crew-context';

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
    <p *ngIf="!loading && !loadFailed && !crews.length" class="mt-3">Cria a tua primeira tripulação. Não precisas de enviar convites.</p>
    <ul class="mt-3 space-y-2"><li *ngFor="let crew of crews" class="flex flex-wrap items-center justify-between gap-3 py-2">
      <span class="break-all">{{ crew.name }} <span class="text-sm text-slate-300">· Proprietário</span></span>
      <button type="button" class="soft-button rounded-lg px-4 py-3" (click)="open(crew)" [attr.aria-label]="'Abrir tripulação ' + crew.name">Abrir</button>
    </li></ul>
    <form (ngSubmit)="create()" class="mt-5 flex flex-wrap items-end gap-3">
      <label class="flex-1 min-w-0">Nome da nova tripulação<input name="crewName" [(ngModel)]="name" required maxlength="100" [disabled]="busy" class="themed-input w-full rounded-lg p-3 mt-1"></label>
      <button type="submit" class="accent-button rounded-lg px-4 py-3" [disabled]="busy || loading || loadFailed || !name.trim()">{{ busy ? 'A criar…' : 'Criar tripulação' }}</button>
    </form>
    <p class="text-sm text-slate-300 mt-3">A captura e sincronização offline destas novas tripulações serão disponibilizadas numa fase posterior.</p>
  </section>`,
})
export class CrewManagerComponent implements OnInit, OnDestroy {
  crews: CrewContext[] = []; selected = getCrewContext(); name = ''; requestKey = ''; error = '';
  loading = false; loadFailed = false; busy = false;
  private requests = new Subscription();
  private requestName = '';
  private readonly accountSession = localStorage.getItem('recce_auth_token');
  private sessionMatches(): boolean {
    if (localStorage.getItem('recce_auth_token') === this.accountSession) return true;
    this.crews = []; this.selected = null; this.loading = false; this.busy = false;
    this.error = 'A sessão mudou. Atualiza esta página antes de continuar.';
    return false;
  }
  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); }
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
  ngOnDestroy() { this.requests.unsubscribe(); }
}
