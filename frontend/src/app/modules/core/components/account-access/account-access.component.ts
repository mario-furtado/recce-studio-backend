import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { API_BASE_URL } from '../../services/api.config';

@Component({
  selector: 'app-account-access', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="app-shell min-h-screen p-4 md:p-8 grid place-items-center">
      <section class="glass-panel rounded-2xl p-6 md:p-8 w-full max-w-xl">
        <h1 class="text-2xl font-black mb-3">{{ title }}</h1>
        <p *ngIf="!loaded" role="status">A verificar disponibilidade…</p>
        <p *ngIf="loaded && !available" role="status">O registo e a recuperação de acesso estão temporariamente indisponíveis.</p>
        <p *ngIf="available && !confirming" class="mb-4">Indica o teu email. Receberás instruções se o pedido puder ser aplicado. No registo, defines a password ao confirmar o endereço.</p>
        <p *ngIf="message" role="status" class="my-4">{{ message }}</p>
        <p *ngIf="error" role="alert" class="text-red-300 my-4">{{ error }}</p>
        <form *ngIf="available && !completed" (ngSubmit)="submit()" class="space-y-4">
          <label *ngIf="!confirming" class="block">Email<input name="email" type="email" autocomplete="email" required maxlength="254" [(ngModel)]="email" class="themed-input w-full rounded-lg p-3 mt-1" [disabled]="busy"></label>
          <ng-container *ngIf="confirming">
            <p>Escolhe uma password de 12 a 128 caracteres.</p>
            <label class="block">Nova password<input name="password" type="password" autocomplete="new-password" required [(ngModel)]="password" class="themed-input w-full rounded-lg p-3 mt-1" [disabled]="busy"></label>
            <label class="block">Confirmar password<input name="repeat" type="password" autocomplete="new-password" required [(ngModel)]="repeatPassword" class="themed-input w-full rounded-lg p-3 mt-1" [disabled]="busy"></label>
          </ng-container>
          <button type="submit" class="accent-button rounded-lg px-4 py-3" [disabled]="busy || (confirming && !token)">{{ busy ? 'A processar…' : confirming ? 'Confirmar password' : 'Pedir email' }}</button>
        </form>
        <div class="flex flex-wrap gap-3 mt-6">
          <a routerLink="/login" class="soft-button rounded-lg px-4 py-3">Voltar ao login</a>
          <a *ngIf="confirming && !completed" [routerLink]="page === 'verify' ? '/register' : '/recover-access'" class="soft-button rounded-lg px-4 py-3">Pedir novo link</a>
          <button *ngIf="!available && !busy" type="button" (click)="load()" class="soft-button rounded-lg px-4 py-3">Tentar novamente</button>
        </div>
      </section>
    </main>`,
})
export class AccountAccessComponent implements OnInit, OnDestroy {
  page: 'register' | 'recover' | 'verify' | 'reset';
  email = ''; password = ''; repeatPassword = ''; token = ''; message = ''; error = '';
  loaded = false; available = false; busy = false; completed = false;
  private requests = new Subscription();
  constructor(private route: ActivatedRoute, private http: HttpClient) { this.page = route.snapshot.data['page']; }
  get confirming() { return this.page === 'verify' || this.page === 'reset'; }
  get title() { return { register: 'Criar conta pessoal', recover: 'Recuperar acesso', verify: 'Verificar email', reset: 'Definir nova password' }[this.page]; }
  ngOnInit() {
    if (this.confirming) {
      this.token = new URLSearchParams(this.route.snapshot.fragment ?? '').get('token') ?? '';
      history.replaceState(history.state, '', location.pathname + location.search);
      if (!/^[a-f0-9]{64}$/.test(this.token)) { this.token = ''; this.error = 'O link não é válido. Pede um novo link.'; }
    }
    this.load();
  }
  load() {
    this.loaded = false;
    this.requests.add(this.http.get<{ available: boolean }>(`${API_BASE_URL}/api/auth/account-options`).subscribe({
      next: value => { this.available = value.available; this.loaded = true; },
      error: () => { this.available = false; this.loaded = true; this.error = 'Não foi possível contactar o serviço. Tenta novamente.'; },
    }));
  }
  submit() {
    if (this.busy || !this.available) return;
    this.error = ''; this.message = '';
    if (this.confirming && (!this.token || [...this.password].length < 12 || [...this.password].length > 128 || !this.password.trim() || this.password !== this.repeatPassword)) {
      this.error = 'Usa uma password de 12 a 128 caracteres e confirma que os dois campos são iguais.'; return;
    }
    if (!this.confirming && !this.email.trim()) { this.error = 'Indica o teu email.'; return; }
    const path = { register: 'register', recover: 'password-reset/request', verify: 'verify-email', reset: 'password-reset/confirm' }[this.page];
    this.busy = true;
    this.requests.add(this.http.post<{ message?: string } | null>(`${API_BASE_URL}/api/auth/${path}`, this.confirming ? { token: this.token, password: this.password } : { email: this.email }).subscribe({
      next: value => {
        this.busy = false;
        if (this.confirming) { this.completed = true; this.token = ''; this.password = ''; this.repeatPassword = ''; this.message = this.page === 'verify' ? 'Email confirmado. Já podes iniciar sessão.' : 'Password atualizada. Inicia sessão com a nova password.'; }
        else this.message = value?.message ?? 'Se o pedido for aplicável, receberás um email com instruções.';
      },
      error: response => { this.busy = false; this.error = response.error?.message ?? 'Não foi possível concluir o pedido. Tenta novamente.'; },
    }));
  }
  ngOnDestroy() { this.requests.unsubscribe(); this.token = ''; this.password = ''; this.repeatPassword = ''; }
}
