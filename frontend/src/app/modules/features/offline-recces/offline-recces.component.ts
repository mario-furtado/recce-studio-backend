import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { NewPec, Pec, Rally } from '../../core/models/rally';
import { AuthService } from '../../core/services/auth.service';
import {
  OfflineRecceSession,
  OfflineRecceStatus,
  OfflineRecceStoreService,
} from '../../core/services/offline-recce-store.service';
import {
  OfflineRecceSyncRequest,
  PecService,
} from '../../core/services/pecs.service';
import { RallyService } from '../../core/services/rally.service';
import { ConfirmDialogService } from '../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { SharedProperties } from '../../core/shared/shared-properties';

@Component({
  selector: 'app-offline-recces',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offline-recces.component.html',
})
export class OfflineReccesComponent implements OnInit, OnDestroy {
  sessions: OfflineRecceSession[] = [];
  rallies: Rally[] = [];
  pecOptions: Pec[] = [];
  selectedPecIds: Record<string, string> = {};
  newPecDrafts: Record<
    string,
    Pick<NewPec, 'number' | 'name' | 'distanceKm'> & { rallyId: string }
  > = {};
  expandedCreateSessionId: string | null = null;
  syncingSessionId: string | null = null;
  isLoading = true;
  isLoadingPecs = false;
  private connectionModeSubscription?: Subscription;

  constructor(
    private auth: AuthService,
    private offlineStore: OfflineRecceStoreService,
    private pecService: PecService,
    private rallyService: RallyService,
    private router: Router,
    private confirmDialog: ConfirmDialogService,
    private shared: SharedProperties,
  ) {}

  ngOnInit(): void {
    this.loadSessions();
    this.connectionModeSubscription = this.shared.connectionMode$.subscribe(
      () => this.syncRemoteOptionsWithConnectionMode(),
    );
  }

  ngOnDestroy(): void {
    this.connectionModeSubscription?.unsubscribe();
  }

  get pendingCount(): number {
    return this.sessions.filter((session) => session.status === 'ready_to_sync')
      .length;
  }

  get draftCount(): number {
    return this.sessions.filter((session) => session.status === 'draft').length;
  }

  get totalNotes(): number {
    return this.visibleSessions.reduce(
      (total, session) => total + session.notesCount,
      0,
    );
  }

  get visibleSessions(): OfflineRecceSession[] {
    return this.sessions.filter((session) => session.status !== 'synced');
  }

  get isOnlineMode(): boolean {
    return (
      this.shared.connectionMode$.value === 'online' &&
      this.auth.isAuthenticated() &&
      !this.auth.isOfflineSession()
    );
  }

  async loadSessions(): Promise<void> {
    this.isLoading = true;
    try {
      this.sessions = await this.offlineStore.listSessions();
      this.sessions.forEach((session) => {
        if (session.pecId) this.selectedPecIds[session.id] = session.pecId;
      });
    } catch (error) {
      console.error('Erro ao carregar reconhecimentos offline:', error);
      this.shared.error('Erro ao carregar reconhecimentos offline');
    } finally {
      this.isLoading = false;
    }
  }

  continueSession(session: OfflineRecceSession): void {
    if (session.status !== 'draft') {
      this.shared.info(
        'Reconhecimento fechado',
        'Apenas sessoes em rascunho podem ser continuadas.',
      );
      return;
    }

    this.router.navigate(['/recce-mode'], {
      queryParams: { offlineSessionId: session.id },
    });
  }

  startNewRecce(): void {
    this.router.navigate(['/recce-mode']);
  }

  syncSession(session: OfflineRecceSession): void {
    if (!this.isOnlineMode) {
      this.shared.info(
        'Modo offline ativo',
        'Volta ao modo online para sincronizar com o backend.',
      );
      return;
    }

    if (session.status !== 'ready_to_sync') {
      this.shared.info(
        'Ainda nao sincronizável',
        'Finalize o reconhecimento antes de sincronizar.',
      );
      return;
    }

    const pecId = this.selectedPecIds[session.id] || session.pecId;
    if (!pecId) {
      this.shared.info(
        'Escolhe uma PEC',
        'Por agora a sincronização manual usa uma PEC existente.',
      );
      return;
    }

    this.syncSessionToBackend(session, { pecId });
  }

  openCreatePec(session: OfflineRecceSession): void {
    if (!this.isOnlineMode) {
      this.shared.info(
        'Modo offline ativo',
        'Volta ao modo online para criar uma PEC no backend.',
      );
      return;
    }

    this.expandedCreateSessionId =
      this.expandedCreateSessionId === session.id ? null : session.id;
    if (this.newPecDrafts[session.id]) return;

    this.newPecDrafts[session.id] = {
      rallyId: this.rallies[0]?.id || '',
      number: this.nextPecNumber(this.rallies[0]?.id),
      name: session.pecName || session.temporaryName,
      distanceKm: 0,
    };
  }

  onCreatePecRallyChange(session: OfflineRecceSession): void {
    const draft = this.newPecDrafts[session.id];
    if (!draft) return;
    draft.number = this.nextPecNumber(draft.rallyId);
  }

  createPecAndSync(session: OfflineRecceSession): void {
    if (!this.isOnlineMode) {
      this.shared.info(
        'Modo offline ativo',
        'Volta ao modo online para sincronizar com o backend.',
      );
      return;
    }

    if (session.status !== 'ready_to_sync') {
      this.shared.info(
        'Ainda nao sincronizavel',
        'Finalize o reconhecimento antes de criar a PEC.',
      );
      return;
    }

    const draft = this.newPecDrafts[session.id];
    if (!draft?.rallyId || !draft.name.trim()) {
      this.shared.info(
        'Dados em falta',
        'Escolhe o rali e indica o nome da PEC.',
      );
      return;
    }

    const newPec: NewPec = {
      number: Number(draft.number) || this.nextPecNumber(draft.rallyId),
      name: draft.name.trim(),
      distanceKm: Number(draft.distanceKm) || 0,
      totalNotes: session.notesCount,
      status: 'DRAFT',
    };

    this.syncSessionToBackend(session, {
      rallyId: draft.rallyId,
      newPec,
    });
  }

  async deleteSession(session: OfflineRecceSession): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar reconhecimento offline',
      message: `Queres eliminar "${session.temporaryName}" deste dispositivo?`,
      detail: 'Esta ação liberta o armazenamento local e não pode ser desfeita.',
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await this.offlineStore.deleteSession(session.id);
      this.sessions = this.sessions.filter((item) => item.id !== session.id);
      this.shared.success('Reconhecimento eliminado');
    } catch (error) {
      console.error('Erro ao eliminar reconhecimento offline:', error);
      this.shared.error('Erro ao eliminar reconhecimento');
    }
  }

  statusLabel(status: OfflineRecceStatus): string {
    const labels: Record<OfflineRecceStatus, string> = {
      draft: 'Rascunho',
      ready_to_sync: 'Por sincronizar',
      syncing: 'A sincronizar',
      synced: 'Sincronizado',
      conflict: 'Conflito',
    };
    return labels[status];
  }

  statusClass(status: OfflineRecceStatus): string {
    if (status === 'ready_to_sync') return 'status-badge-warning';
    if (status === 'synced') return 'status-badge-success';
    if (status === 'conflict') return 'status-badge-danger';
    return '';
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatDuration(seconds: number): string {
    const total = Math.round(seconds || 0);
    const minutes = Math.floor(total / 60);
    const remSeconds = total % 60;
    return `${minutes}:${remSeconds.toString().padStart(2, '0')}`;
  }

  formatAudioSize(size?: number): string {
    if (!size) return 'Sem audio';
    const mb = size / 1024 / 1024;
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }

  trackById(_: number, session: OfflineRecceSession): string {
    return session.id;
  }

  private loadPecOptions(): void {
    if (!this.isOnlineMode) {
      this.rallies = [];
      this.pecOptions = [];
      this.isLoadingPecs = false;
      return;
    }

    this.isLoadingPecs = true;
    this.rallyService
      .getRallies()
      .pipe(
        switchMap((rallies: Rally[]) => {
          this.rallies = rallies;
          if (rallies.length === 0) return of([]);
          return forkJoin(
            rallies.map((rally) =>
              this.rallyService.getRallyPecs(rally.id).pipe(
                map((pecs: Pec[]) =>
                  pecs.map((pec) => ({
                    ...pec,
                    name: `${rally.name} - ${pec.name}`,
                  })),
                ),
                catchError(() => of([] as Pec[])),
              ),
            ),
          ).pipe(map((groups) => groups.flat()));
        }),
      )
      .subscribe({
        next: (pecs) => {
          this.pecOptions = pecs;
          this.isLoadingPecs = false;
        },
        error: () => {
          this.isLoadingPecs = false;
          this.shared.error('Erro ao carregar PECs para sincronizacao');
        },
      });
  }

  private syncSessionToBackend(
    session: OfflineRecceSession,
    target: Pick<OfflineRecceSyncRequest, 'pecId' | 'rallyId' | 'newPec'>,
  ): void {
    if (!this.isOnlineMode) {
      this.shared.info(
        'Modo offline ativo',
        'Volta ao modo online para sincronizar com o backend.',
      );
      return;
    }

    this.syncingSessionId = session.id;
    this.offlineStore
      .markSessionSyncing(session.id)
      .then((updated) => this.replaceSession(updated))
      .then(() => {
        this.pecService
          .syncOfflineRecce({
            sessionId: session.id,
            deviceId: session.deviceId,
            userEmail: session.userEmail,
            temporaryName: session.temporaryName,
            pecId: target.pecId,
            rallyId: target.rallyId,
            newPec: target.newPec,
            createdAt: session.createdAt,
            finishedAt: session.finishedAt,
            notesCount: session.notesCount,
            durationSeconds: session.durationSeconds,
            markers: session.markers,
            gpsTrack: session.gpsTrack || [],
          })
          .subscribe({
            next: async (response) => {
              await this.offlineStore.deleteSession(session.id);
              this.sessions = this.sessions.filter(
                (item) => item.id !== session.id,
              );
              this.expandedCreateSessionId = null;
              delete this.selectedPecIds[session.id];
              delete this.newPecDrafts[session.id];
              this.shared.success(
                'Reconhecimento sincronizado',
                `${response.pecName || response.pecId} foi removido do armazenamento local.`,
              );
              this.syncingSessionId = null;
            },
            error: async (error) => {
              console.error(
                'Erro ao sincronizar reconhecimento offline:',
                error,
              );
              const updated = await this.offlineStore.markSessionReadyToSync(
                session.id,
                'Falha ao enviar para o backend.',
              );
              this.replaceSession(updated);
              this.shared.error(
                'Erro ao sincronizar',
                'Confirma a ligacao ao backend e tenta novamente.',
              );
              this.syncingSessionId = null;
            },
          });
      })
      .catch((error) => {
        console.error('Erro ao preparar sincronizacao:', error);
        this.shared.error('Erro ao preparar sincronizacao');
        this.syncingSessionId = null;
      });
  }

  private nextPecNumber(rallyId?: string): number {
    if (!rallyId) return 1;
    const rallyPecs = this.pecOptions.filter((pec) =>
      pec.name.startsWith(`${this.rallyName(rallyId)} - `),
    );
    if (rallyPecs.length === 0) return 1;
    return Math.max(...rallyPecs.map((pec) => Number(pec.number) || 0)) + 1;
  }

  private rallyName(rallyId: string): string {
    return this.rallies.find((rally) => rally.id === rallyId)?.name || 'Rali';
  }

  private replaceSession(session: OfflineRecceSession | null): void {
    if (!session) return;
    const index = this.sessions.findIndex((item) => item.id === session.id);
    if (index === -1) return;
    this.sessions = [
      ...this.sessions.slice(0, index),
      session,
      ...this.sessions.slice(index + 1),
    ];
  }

  private syncRemoteOptionsWithConnectionMode(): void {
    if (!this.isOnlineMode) {
      this.rallies = [];
      this.pecOptions = [];
      this.isLoadingPecs = false;
      this.expandedCreateSessionId = null;
      return;
    }

    this.loadPecOptions();
  }
}
