import { AsyncPipe, NgIf } from '@angular/common';
import { Component, NgZone, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, merge, of, switchMap } from 'rxjs';
import { InvitationApi } from '../../services/invitation-api';

@Component({
  selector: 'app-invitation-bell',
  imports: [AsyncPipe, NgIf, RouterLink],
  template: `
    <a *ngIf="state$ | async as state" routerLink="/notifications" class="soft-button inline-flex items-center gap-2 min-h-11 px-3 rounded-lg mb-2"
      [attr.aria-label]="state.unread > 0 ? 'Notificações, ' + state.unread + ' por ler' : 'Notificações'">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3zM10 20h4"/>
      </svg>
      Notificações <span *ngIf="state.unread > 0" class="status-badge">{{ state.unread > 99 ? '99+' : state.unread }}</span>
    </a>`,
})
export class InvitationBellComponent {
  private readonly api = inject(InvitationApi);
  private readonly zone = inject(NgZone);
  // Keep the periodic timer out of the app stability check used by the service worker.
  private readonly poll = new Observable<void>(subscriber => this.zone.runOutsideAngular(() => {
    const handle = window.setInterval(() => this.zone.run(() => subscriber.next()), 30_000);
    return () => window.clearInterval(handle);
  }));
  readonly state$ = this.api.options().pipe(
    switchMap(value => value.enabled ? merge(of(undefined), this.poll, this.api.refresh).pipe(
      switchMap(() => this.api.unread().pipe(catchError(() => of({ unread: 0 })))),
    ) : of(null)),
    catchError(() => of(null)),
  );
}
