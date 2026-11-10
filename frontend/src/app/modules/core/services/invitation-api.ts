import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { API_BASE_URL } from './api.config';

export type InvitationState = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export const invitationStatus: Record<InvitationState, string> = {
  PENDING: 'Pendente', ACCEPTED: 'Aceite', DECLINED: 'Recusado', CANCELLED: 'Cancelado', EXPIRED: 'Expirado',
};

export interface Invitation {
  id: string;
  rallyId: string;
  rallyName: string;
  crewName: string;
  recipientEmail?: string;
  state: InvitationState;
  expiresAt: number;
  read: boolean;
}

export interface InvitationPage {
  items: Invitation[];
  hasMore: boolean;
  unread: number;
}

@Injectable({ providedIn: 'root' })
export class InvitationApi {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_URL + '/api';
  readonly refresh = new Subject<void>();

  private rally(id: string) { return this.base + '/rallies/' + encodeURIComponent(id) + '/invitations'; }
  private invitation(id: string) { return this.base + '/invitations/' + encodeURIComponent(id); }

  options() { return this.http.get<{ enabled: boolean }>(this.base + '/invitations/options'); }
  received(page = 0) { return this.http.get<InvitationPage>(this.base + '/notifications', { params: { page } }); }
  unread() { return this.http.get<{ unread: number }>(this.base + '/notifications/unread'); }
  sent(id: string, page: number) { return this.http.get<InvitationPage>(this.rally(id), { params: { page } }); }
  detail(id: string) { return this.http.get<Invitation>(this.invitation(id)); }
  send(id: string, email: string) { return this.http.post<{ message: string }>(this.rally(id), { email }); }
  cancel(rally: string, id: string) {
    return this.http.post<void>(this.rally(rally) + '/' + encodeURIComponent(id) + '/cancel', null);
  }
  markRead(id: string) {
    return this.http.patch<Invitation>(this.base + '/notifications/' + encodeURIComponent(id) + '/read', null);
  }
  decide(id: string, action: 'accept' | 'decline') {
    return this.http.post<Invitation>(this.invitation(id) + '/' + action, null);
  }
}
