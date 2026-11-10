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
  accessStatus?: 'ACTIVE' | 'REVOKED' | 'UNAVAILABLE';
}

export type RevocationReason = 'COLLABORATION_ENDED' | 'SHARING_ERROR' | 'OTHER';
export interface RallyGrant {
  id: number;
  recipientEmail: string;
  active: boolean;
  revokedAt: number | null;
  revocationReason: RevocationReason | null;
}

export interface AccessEvent {
  id: number;
  actorId: string;
  recipientId: string | null;
  invitationId: string | null;
  grantId: number | null;
  action: 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'REVOKED';
  occurredAt: number;
  reason: RevocationReason | null;
}

interface AccessPage<T> { items: T[]; hasMore: boolean; }

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
  private access(id: string) { return this.base + '/rallies/' + encodeURIComponent(id) + '/access'; }
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
  grants(rally: string, page: number) { return this.http.get<AccessPage<RallyGrant>>(this.access(rally), { params: { page } }); }
  history(rally: string, page: number) { return this.http.get<AccessPage<AccessEvent>>(this.access(rally) + '/history', { params: { page } }); }
  revoke(rally: string, id: number, reason: RevocationReason) {
    return this.http.post<void>(this.access(rally) + '/' + id + '/revoke', { reason });
  }
  markRead(id: string) {
    return this.http.patch<Invitation>(this.base + '/notifications/' + encodeURIComponent(id) + '/read', null);
  }
  decide(id: string, action: 'accept' | 'decline') {
    return this.http.post<Invitation>(this.invitation(id) + '/' + action, null);
  }
}
