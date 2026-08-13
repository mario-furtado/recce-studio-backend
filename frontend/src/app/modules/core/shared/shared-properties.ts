import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppTheme = 'racing-red' | 'midnight-blue' | 'forest-green';
export type AppShellTheme = 'dark-blue' | 'light';
export type AppAccentTheme = AppTheme;
export type ToastType = 'success' | 'error' | 'info';
export type ConnectionMode = 'online' | 'offline';
export type VoiceCaptureMode = 'push-to-talk' | 'always-active';

export interface AppToast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SharedProperties {
  private toastId = 0;
  private readonly themeKey = 'recce_theme';
  private readonly shellThemeKey = 'recce_shell_theme';
  private readonly accentThemeKey = 'recce_accent_theme';
  private readonly connectionModeKey = 'recce_connection_mode';
  private readonly voiceCaptureModeKey = 'recce_voice_capture_mode';

  readonly shellTheme$ = new BehaviorSubject<AppShellTheme>(
    this.loadShellTheme(),
  );
  readonly accentTheme$ = new BehaviorSubject<AppAccentTheme>(
    this.loadAccentTheme(),
  );
  readonly theme$ = this.accentTheme$;
  readonly connectionMode$ = new BehaviorSubject<ConnectionMode>(
    this.loadConnectionMode(),
  );
  readonly voiceCaptureMode$ = new BehaviorSubject<VoiceCaptureMode>(
    this.loadVoiceCaptureMode(),
  );
  readonly toasts$ = new BehaviorSubject<AppToast[]>([]);

  constructor() {
    this.applyTheme(this.shellTheme$.value, this.accentTheme$.value);
  }

  setTheme(theme: AppTheme): void {
    this.setAccentTheme(theme);
  }

  setShellTheme(theme: AppShellTheme): void {
    localStorage.setItem(this.shellThemeKey, theme);
    this.shellTheme$.next(theme);
    this.applyTheme(theme, this.accentTheme$.value);
    this.success(
      'Tema atualizado',
      'O ambiente geral da aplicação foi atualizado.',
    );
  }

  setAccentTheme(theme: AppAccentTheme): void {
    const accentTheme: AppAccentTheme = this.isAccentTheme(theme)
      ? theme
      : 'racing-red';
    localStorage.setItem(this.themeKey, accentTheme);
    localStorage.setItem(this.accentThemeKey, accentTheme);
    this.accentTheme$.next(accentTheme);
    this.applyTheme(this.shellTheme$.value, accentTheme);
    this.success(
      'Detalhe atualizado',
      'A cor de destaque da interface foi atualizada.',
    );
  }

  setConnectionMode(
    mode: ConnectionMode,
    options: { silent?: boolean } = {},
  ): void {
    localStorage.setItem(this.connectionModeKey, mode);
    this.connectionMode$.next(mode);
    if (options.silent) return;
    if (mode === 'offline') {
      this.info(
        'Modo offline ativo',
        'Disponível para novo reconhecimento e ficheiros locais.',
      );
      return;
    }
    this.success(
      'Modo online ativo',
      'Servicos e sincronização voltaram a estar ativos.',
    );
  }

  toggleConnectionMode(): void {
    this.setConnectionMode(
      this.connectionMode$.value === 'online' ? 'offline' : 'online',
    );
  }

  setVoiceCaptureMode(mode: VoiceCaptureMode): void {
    localStorage.setItem(this.voiceCaptureModeKey, mode);
    this.voiceCaptureMode$.next(mode);
    this.success(
      'Modo de voz atualizado',
      mode === 'push-to-talk'
        ? 'Segura o botao da nota para ditar.'
        : 'A transcrição fica sempre ativa durante o reconhecimento.',
    );
  }

  success(title: string, message?: string): void {
    this.toast('success', title, message);
  }

  error(title: string, message?: string): void {
    this.toast('error', title, message);
  }

  info(title: string, message?: string): void {
    this.toast('info', title, message);
  }

  dismissToast(id: number): void {
    this.toasts$.next(this.toasts$.value.filter((toast) => toast.id !== id));
  }

  private toast(type: ToastType, title: string, message?: string): void {
    const alreadyVisible = this.toasts$.value.some(
      (toast) =>
        toast.type === type &&
        toast.title === title &&
        toast.message === message,
    );
    if (alreadyVisible) return;

    const id = ++this.toastId;
    this.toasts$.next([...this.toasts$.value, { id, type, title, message }]);
    window.setTimeout(() => this.dismissToast(id), 3800);
  }

  private loadTheme(): AppTheme {
    const theme = localStorage.getItem(this.themeKey) as AppTheme | null;
    return this.isAccentTheme(theme) ? theme : 'racing-red';
  }

  private loadShellTheme(): AppShellTheme {
    const theme = localStorage.getItem(this.shellThemeKey);
    if (theme === 'black') return 'dark-blue';
    if (theme === 'white') return 'light';
    return this.isShellTheme(theme) ? theme : 'dark-blue';
  }

  private loadAccentTheme(): AppAccentTheme {
    const theme = localStorage.getItem(
      this.accentThemeKey,
    ) as AppAccentTheme | null;
    return this.isAccentTheme(theme) ? theme : 'racing-red';
  }

  private loadConnectionMode(): ConnectionMode {
    return (
      (localStorage.getItem(this.connectionModeKey) as ConnectionMode) ||
      'online'
    );
  }

  private loadVoiceCaptureMode(): VoiceCaptureMode {
    const mode = localStorage.getItem(
      this.voiceCaptureModeKey,
    ) as VoiceCaptureMode | null;
    return this.isVoiceCaptureMode(mode) ? mode : 'push-to-talk';
  }

  private applyTheme(
    shellTheme: AppShellTheme,
    accentTheme: AppAccentTheme,
  ): void {
    document.documentElement.dataset['shellTheme'] = shellTheme;
    document.documentElement.dataset['accentTheme'] = accentTheme;
    document.documentElement.dataset['theme'] = accentTheme;
  }

  private isShellTheme(theme: string | null): theme is AppShellTheme {
    return theme === 'dark-blue' || theme === 'light';
  }

  private isAccentTheme(theme: string | null): theme is AppAccentTheme {
    return theme === 'racing-red';
  }

  private isVoiceCaptureMode(mode: string | null): mode is VoiceCaptureMode {
    return mode === 'push-to-talk' || mode === 'always-active';
  }
}
