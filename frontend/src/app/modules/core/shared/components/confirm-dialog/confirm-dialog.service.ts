import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ConfirmDialogTone = 'default' | 'danger';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmDialogTone;
}

export interface ConfirmDialogState extends ConfirmDialogOptions {
  tone: ConfirmDialogTone;
  confirmText: string;
  cancelText: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  readonly state$ = new BehaviorSubject<ConfirmDialogState | null>(null);
  private resolveCurrent?: (confirmed: boolean) => void;

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    this.resolveCurrent?.(false);

    const state: ConfirmDialogState = {
      ...options,
      tone: options.tone || 'default',
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
    };

    this.state$.next(state);
    return new Promise<boolean>((resolve) => {
      this.resolveCurrent = resolve;
    });
  }

  accept(): void {
    this.close(true);
  }

  dismiss(): void {
    this.close(false);
  }

  private close(confirmed: boolean): void {
    this.state$.next(null);
    this.resolveCurrent?.(confirmed);
    this.resolveCurrent = undefined;
  }
}
