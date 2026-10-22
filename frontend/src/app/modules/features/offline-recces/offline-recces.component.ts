import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, forkJoin, of, Subscription } from 'rxjs';
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
    return this.visibleSessions.filter((session) => session.status === 'ready_to_sync')
      .length;
  }

  get draftCount(): number {
    return this.visibleSessions.filter((session) => session.status === 'draft').length;
  }

  get totalNotes(): number {
    return this.visibleSessions.reduce(
      (total, session) => total + session.notesCount,
      0,
    );
  }

  get visibleSessions(): OfflineRecceSession[] {
    return this.sessions.filter((session) => session.status !== 'synced' && this.offlineStore.canAccessSession(session));
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
      await this.offlineStore.recoverInterruptedSyncs();
      this.sessions = await this.offlineStore.listSessions();
      this.sessions.forEach((session) => {
        if (session.pecId) this.selectedPecIds[session.id] = session.pecId;
      });
    } catch (error) {
      this.sessions = [];
      console.error('Erro ao carregar reconhecimentos offline:', error);
      this.shared.error('Erro ao carregar reconhecimentos offline');
    } finally {
      this.isLoading = false;
    }
  }

  async continueSession(session: OfflineRecceSession): Promise<void> {
    const current = await this.offlineStore.getSession(session.id).catch(() => null);
    if (!current || !this.offlineStore.canAccessSession(current)) {
      this.shared.error('Sessão indisponível', 'Este reconhecimento não está disponível para a conta atual.');
      return;
    }
    session = current;
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

  async syncSession(session: OfflineRecceSession): Promise<void> {
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

    await this.syncSessionToBackend(session, { pecId });
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

  async createPecAndSync(session: OfflineRecceSession): Promise<void> {
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

    await this.syncSessionToBackend(session, {
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

  private async syncSessionToBackend(
    session: OfflineRecceSession,
    target: Pick<OfflineRecceSyncRequest, 'pecId' | 'rallyId' | 'newPec'>,
  ): Promise<void> {
    if (!this.isOnlineMode) {
      this.shared.info(
        'Modo offline ativo',
        'Volta ao modo online para sincronizar com o backend.',
      );
      return;
    }

    if (this.syncingSessionId) return;
    this.syncingSessionId = session.id;
    try {
      const started = await this.offlineStore.runSessionSync(session.id, async (current) => {
        this.replaceSession(current);
        try {
          const response = await firstValueFrom(this.pecService.syncOfflineRecce({
            sessionId: session.id,
            deviceId: current.deviceId,
            userEmail: current.userEmail,
            temporaryName: current.temporaryName,
            pecId: target.pecId,
            rallyId: target.rallyId,
            newPec: target.newPec,
            createdAt: current.createdAt,
            finishedAt: current.finishedAt,
            notesCount: current.notesCount,
            durationSeconds: current.durationSeconds,
            markers: current.markers,
            gpsTrack: current.gpsTrack || [],
          }));
          const audioUploaded = await this.uploadSessionAudio(current, response.pecId);
          if (!audioUploaded) {
            const updated = await this.offlineStore.markSessionReadyToSync(
              session.id, 'Notas sincronizadas, mas o áudio está em falta ou não pôde ser enviado.',
            );
            this.replaceSession(updated);
            this.shared.error(
              'Áudio não sincronizado',
              'As notas foram enviadas, mas o áudio está em falta ou não pôde ser enviado. A sessão foi mantida. Não apagues a sessão nem os dados deste navegador; confirma que a gravação está disponível antes de tentares novamente.',
            );
            return;
          }
          await this.offlineStore.deleteSession(session.id);
          this.sessions = this.sessions.filter((item) => item.id !== session.id);
          this.expandedCreateSessionId = null;
          delete this.selectedPecIds[session.id];
          delete this.newPecDrafts[session.id];
          this.shared.success(
            'Reconhecimento sincronizado',
            `${response.pecName || response.pecId} foi removido do armazenamento local.`,
          );
        } catch (error) {
          console.error('Erro ao sincronizar reconhecimento offline:', error);
          const updated = await this.offlineStore.markSessionReadyToSync(
            session.id, 'Falha ao enviar para o backend.',
          );
          this.replaceSession(updated);
          this.shared.error('Erro ao sincronizar', 'Confirma a ligacao ao backend e tenta novamente.');
        }
      });
      if (!started) await this.loadSessions();
    } catch (error) {
      console.error('Erro ao preparar sincronizacao:', error);
      this.shared.error('Erro ao preparar sincronizacao');
    } finally {
      this.syncingSessionId = null;
    }
  }

  private async uploadSessionAudio(
    session: OfflineRecceSession,
    pecId: string,
  ): Promise<boolean> {
    if (!session.audioBlobId) return true;
    const audioBlob = await this.offlineStore.getAudioBlob(session.audioBlobId);
    if (!audioBlob) return false;

    try {
      await firstValueFrom(
        this.pecService.uploadAudio(
          pecId,
          audioBlob,
          this.audioFileNameFromMime(session.audioMimeType || audioBlob.type),
        ),
      );
      return true;
    } catch (error) {
      console.error('Erro ao sincronizar audio offline:', error);
      return false;
    }
  }

  private audioFileNameFromMime(mimeType?: string): string {
    const normalized = (mimeType || '').toLowerCase();
    if (normalized.includes('mp4') || normalized.includes('aac')) return 'recce-audio.m4a';
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'recce-audio.mp3';
    if (normalized.includes('ogg')) return 'recce-audio.ogg';
    if (normalized.includes('wav')) return 'recce-audio.wav';
    return 'recce-audio.webm';
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
