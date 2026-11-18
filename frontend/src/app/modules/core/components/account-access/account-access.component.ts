import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { API_BASE_URL } from '../../services/api.config';
import { AuthService, RegistrationResponse } from '../../services/auth.service';

@Component({
  selector: 'app-account-access', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="app-shell min-h-screen p-4 md:p-8 grid place-items-center">
      <section class="glass-panel rounded-2xl p-6 md:p-8 w-full max-w-xl">
        <h1 class="text-2xl font-black mb-3">{{ title }}</h1>
        <p *ngIf="!loaded" role="status">A verificar disponibilidade…</p>
        <ng-container *ngIf="registrationId">
          <p class="mb-4">Introduz o código de seis dígitos pedido para <strong>{{ email }}</strong>.</p>
          <p *ngIf="secondsRemaining > 0" class="mb-4">Tempo restante <span role="timer">{{ remainingTime }}</span></p>
          <p *ngIf="secondsRemaining === 0" role="status" class="mb-4">Pede um novo código para continuar.</p>
        </ng-container>
        <p *ngIf="available && page === 'recover'" class="mb-4">Indica o teu email para repor a password ou reativar uma conta que desativaste.</p>
        <p *ngIf="loaded && !available && !availabilityError" role="status" class="surface-card rounded-xl p-3 mb-4">{{ unavailableMessage }}</p>
        <p *ngIf="availabilityError" role="alert" class="text-red-300 mb-4">Não foi possível contactar o serviço de contas. Tenta novamente.</p>
        <p *ngIf="message" role="status" class="my-4">{{ message }}</p>
        <p *ngIf="error" role="alert" class="text-red-300 my-4">{{ error }}</p>
        <form *ngIf="registrationId && !editingEmail && !completed" (ngSubmit)="confirmRegistration()" class="space-y-4">
          <label class="block">Código de verificação
            <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"
              required [(ngModel)]="code" class="themed-input w-full rounded-lg p-3 mt-1" [disabled]="busy">
          </label>
          <div class="flex flex-wrap gap-3">
            <button type="submit" [disabled]="busy || secondsRemaining === 0 || code.length !== 6"
              class="accent-button rounded-lg px-4 py-3 disabled:opacity-60">Confirmar email</button>
            <button type="button" [disabled]="busy" (click)="resendRegistration()"
              class="soft-button rounded-lg px-4 py-3">Reenviar código</button>
            <button type="button" [disabled]="busy" (click)="startEmailCorrection()"
              class="soft-button rounded-lg px-4 py-3">Corrigir email</button>
          </div>
        </form>
        <form *ngIf="registrationId && editingEmail && !completed" (ngSubmit)="resendRegistration(correctedEmail)" class="space-y-4">
          <label class="block">Novo email<input name="correctedEmail" type="email" autocomplete="email" required maxlength="254"
            [(ngModel)]="correctedEmail" class="themed-input w-full rounded-lg p-3 mt-1" [disabled]="busy"></label>
          <div class="flex flex-wrap gap-3">
            <button type="submit" [disabled]="busy" class="accent-button rounded-lg px-4 py-3">Enviar código</button>
            <button type="button" [disabled]="busy" (click)="editingEmail = false" class="soft-button rounded-lg px-4 py-3">Cancelar</button>
          </div>
        </form>
        <form *ngIf="!registrationId && (page === 'register' || available) && !completed" (ngSubmit)="submit()" class="space-y-4">
          <fieldset *ngIf="!confirming" [disabled]="!available || busy" class="space-y-4">
            <label class="block">Email<input name="email" type="email" autocomplete="email" required maxlength="254" [(ngModel)]="email" class="themed-input w-full rounded-lg p-3 mt-1"></label>
            <ng-container *ngIf="page === 'register'">
              <label class="block">Nome<input name="displayName" autocomplete="name" maxlength="120" required
                [(ngModel)]="displayName" class="themed-input w-full rounded-lg p-3 mt-1"></label>
              <label class="block">Data de nascimento<input name="dateOfBirth" type="date" autocomplete="bday" min="0001-01-01" required
                [(ngModel)]="dateOfBirth" class="themed-input w-full rounded-lg p-3 mt-1"></label>
              <p>Escolhe uma password de 12 a 128 caracteres.</p>
              <label class="block">Password<input name="password" type="password" autocomplete="new-password" required
                [(ngModel)]="password" class="themed-input w-full rounded-lg p-3 mt-1"></label>
              <label class="block">Confirmar password<input name="repeat" type="password" autocomplete="new-password" required
                [(ngModel)]="repeatPassword" class="themed-input w-full rounded-lg p-3 mt-1"></label>
            </ng-container>
          </fieldset>
          <ng-container *ngIf="confirming">
            <ng-container *ngIf="page === 'verify'">
              <label class="block">Nome<input name="displayName" autocomplete="name" maxlength="120" required
                [(ngModel)]="displayName" class="themed-input w-full rounded-lg p-3 mt-1" [disabled]="busy"></label>
              <label class="block">Data de nascimento<input name="dateOfBirth" type="date" autocomplete="bday" min="0001-01-01" required
                [(ngModel)]="dateOfBirth" class="themed-input w-full rounded-lg p-3 mt-1" [disabled]="busy"></label>
            </ng-container>
            <p>Escolhe uma password de 12 a 128 caracteres.</p>
            <label class="block">Nova password<input name="password" type="password" autocomplete="new-password" required [(ngModel)]="password" class="themed-input w-full rounded-lg p-3 mt-1" [disabled]="busy"></label>
            <label class="block">Confirmar password<input name="repeat" type="password" autocomplete="new-password" required [(ngModel)]="repeatPassword" class="themed-input w-full rounded-lg p-3 mt-1" [disabled]="busy"></label>
          </ng-container>
          <button type="submit" class="accent-button rounded-lg px-4 py-3 disabled:opacity-60"
            [disabled]="!available || busy || (confirming && !token)">{{ submitLabel }}</button>
        </form>
        <div class="flex flex-wrap gap-3 mt-6">
          <a routerLink="/login" class="soft-button rounded-lg px-4 py-3">Voltar ao login</a>
          <a *ngIf="confirming && !completed" [routerLink]="page === 'verify' ? '/register' : '/recover-access'" class="soft-button rounded-lg px-4 py-3">Pedir novo link</a>
          <button *ngIf="loaded && !available" type="button" (click)="load()" class="soft-button rounded-lg px-4 py-3">Tentar novamente</button>
        </div>
      </section>
    </main>`,
})
export class AccountAccessComponent implements OnInit, OnDestroy {
  page: 'register' | 'recover' | 'verify' | 'reset';
  email = ''; password = ''; repeatPassword = ''; token = ''; message = ''; error = '';
  displayName = ''; dateOfBirth = '';
  registrationId = ''; code = ''; correctedEmail = '';
  secondsRemaining = 0; editingEmail = false;
  private timer?: ReturnType<typeof setInterval>;
  loaded = false; available = false; busy = false; completed = false;
  availabilityError = false;
  private requests = new Subscription();
  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router, private auth: AuthService) {
    this.page = route.snapshot.data['page'];
  }
  get confirming() { return this.page === 'verify' || this.page === 'reset'; }
  get title() { return this.registrationId ? 'Verifica o teu email' : { register: 'Criar conta pessoal', recover: 'Recuperar acesso', verify: 'Verificar email', reset: 'Definir nova password' }[this.page]; }
  get remainingTime() {
    return `${Math.floor(this.secondsRemaining / 60)}:${String(this.secondsRemaining % 60).padStart(2, '0')}`;
  }
  get submitLabel() {
    if (this.busy) return 'A processar…';
    if (this.page === 'verify') return 'Criar conta';
    if (this.confirming) return 'Confirmar password';
    return this.page === 'register' ? 'Enviar código de verificação' : 'Pedir email';
  }
  get unavailableMessage() {
    if (this.page === 'register') return 'O envio de códigos de verificação ainda não está disponível nesta instalação.';
    return this.page === 'recover' ? 'A recuperação de acesso está temporariamente indisponível.'
      : 'A confirmação deste link está temporariamente indisponível.';
  }
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
    this.availabilityError = false;
    this.requests.add(this.http.get<{ available: boolean }>(`${API_BASE_URL}/api/auth/account-options`).subscribe({
      next: value => { this.available = value.available; this.loaded = true; },
      error: () => { this.available = false; this.loaded = true; this.availabilityError = true; },
    }));
  }
  submit() {
    if (this.busy || !this.available) return;
    this.error = ''; this.message = '';
    if ((this.page === 'verify' || this.page === 'register') && (!this.displayName.trim() || !this.dateOfBirth)) {
      this.error = 'Preenche o nome e a data de nascimento.';
      return;
    }
    if ((this.confirming && !this.token) || ((this.confirming || this.page === 'register') &&
      ([...this.password].length < 12 || [...this.password].length > 128 || !this.password.trim() || this.password !== this.repeatPassword))) {
      this.error = 'Usa uma password de 12 a 128 caracteres e confirma que os dois campos são iguais.'; return;
    }
    if (!this.confirming && !this.email.trim()) { this.error = 'Indica o teu email.'; return; }
    if (this.page === 'register') {
      this.requestRegistration(this.auth.register({
        email: this.email.trim(), password: this.password, displayName: this.displayName.trim(), dateOfBirth: this.dateOfBirth,
      }), this.email.trim());
      return;
    }
    const path = { recover: 'password-reset/request', verify: 'verify-email', reset: 'password-reset/confirm' }[this.page];
    const proof = { token: this.token, password: this.password };
    const body = this.page === 'verify'
      ? { ...proof, displayName: this.displayName.trim(), dateOfBirth: this.dateOfBirth }
      : this.confirming ? proof : { email: this.email };
    this.busy = true;
    this.requests.add(this.http.post<{ message?: string } | null>(`${API_BASE_URL}/api/auth/${path}`, body).subscribe({
      next: value => {
        this.busy = false;
        if (this.confirming) {
          this.completed = true;
          this.token = '';
          this.password = '';
          this.repeatPassword = '';
          const verified = this.page === 'verify';
          this.message = verified ? 'Email confirmado. Já podes iniciar sessão.' : 'Password atualizada. Inicia sessão com a nova password.';
          void this.router.navigate(['/login'], { replaceUrl: true, info: verified ? 'account-verified' : 'password-reset' });
        } else {
          this.message = value?.message ?? 'Se o pedido for aplicável, receberás um email com instruções.';
        }
      },
      error: response => { this.busy = false; this.error = response.error?.message ?? 'Não foi possível concluir o pedido. Tenta novamente.'; },
    }));
  }

  startEmailCorrection() {
    this.correctedEmail = this.email;
    this.editingEmail = true;
    this.error = '';
  }

  resendRegistration(email?: string) {
    if (this.busy || (email !== undefined && !email.trim())) return;
    this.requestRegistration(this.auth.resendRegistration(this.registrationId, email?.trim()), email?.trim() ?? this.email);
  }

  private requestRegistration(request: Observable<RegistrationResponse>, email: string) {
    this.busy = true;
    this.error = '';
    this.requests.add(request.subscribe({
      next: result => {
        const resent = Boolean(this.registrationId);
        this.registrationId = result.requestId;
        this.email = email;
        this.password = '';
        this.repeatPassword = '';
        this.code = '';
        this.editingEmail = false;
        this.busy = false;
        this.message = resent ? 'Pediste um novo código. Usa o email mais recente.' : '';
        this.startTimer(result.remainingSeconds);
      },
      error: response => this.registrationError(response),
    }));
  }

  confirmRegistration() {
    if (this.busy || this.secondsRemaining === 0 || !/^[0-9]{6}$/.test(this.code)) return;
    this.busy = true;
    this.error = '';
    this.message = '';
    this.requests.add(this.auth.confirmRegistration(this.registrationId, this.code).subscribe({
      next: () => {
        this.busy = false;
        this.completed = true;
        this.registrationId = '';
        this.code = '';
        clearInterval(this.timer);
        this.message = 'Email confirmado. Já podes iniciar sessão.';
        void this.router.navigate(['/login'], { replaceUrl: true, info: 'account-verified' });
      },
      error: response => this.registrationError(response),
    }));
  }

  private registrationError(response: { status: number; error?: { message?: string } }) {
    this.busy = false;
    this.message = '';
    if (response.status === 410) {
      this.registrationId = '';
      this.code = '';
      this.editingEmail = false;
      clearInterval(this.timer);
    }
    this.error = response.error?.message ?? 'Não foi possível concluir o pedido. Tenta novamente.';
  }

  private startTimer(seconds: number) {
    clearInterval(this.timer);
    this.secondsRemaining = seconds;
    if (seconds <= 0) return;
    const deadline = Date.now() + seconds * 1000;
    this.timer = setInterval(() => {
      this.secondsRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (this.secondsRemaining === 0) clearInterval(this.timer);
    }, 250);
  }

  ngOnDestroy() { this.requests.unsubscribe(); clearInterval(this.timer); this.token = ''; this.password = ''; this.repeatPassword = ''; }
}
