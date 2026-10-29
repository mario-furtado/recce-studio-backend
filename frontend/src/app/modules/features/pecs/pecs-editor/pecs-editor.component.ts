import {
  Component,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  Input,
  Optional,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { Note } from '../../../core/models/rally';
import { ClickMarker } from '../../../core/services/tracking.service';
import {
  GpsPoint,
  PecAssets,
  PecService,
} from '../../../core/services/pecs.service';
import { OfflineRecceStoreService } from '../../../core/services/offline-recce-store.service';
import { SharedProperties } from '../../../core/shared/shared-properties';
import { ConfirmDialogService } from '../../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { RecceMapComponent } from './recce-map.component';
import { MapNote, notesOnMap, trackSegments } from './gps-timeline';
import { NotebookComponent } from '../../../core/notebook/notebook.component';
import { NoteDisplayComponent } from '../../../core/notebook/note-display.component';
import { NotebookService } from '../../../core/notebook/notebook.service';
import { defaultNotebook } from '../../../core/notebook/notebook.model';
import { NotePresentationEditorComponent } from '../../../core/notebook/note-presentation-editor.component';
import { presentationError } from '../../../core/notebook/note-presentation';
import { ContextPanelComponent } from '../../../core/shared/components/context-panel.component';
import { FocusPanelComponent } from '../../../core/shared/components/focus-panel.component';
import { StudioAssetsComponent } from './studio-assets.component';

@Component({
  selector: 'app-pecs-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RecceMapComponent, NotebookComponent, NoteDisplayComponent, NotePresentationEditorComponent, ContextPanelComponent, FocusPanelComponent, StudioAssetsComponent],
  templateUrl: './pecs-editor.component.html',
  styleUrl: './pecs-editor.component.css',
})
export class PecsEditorComponent implements OnInit, OnDestroy {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('audioPlayer') audioPlayer!: ElementRef<HTMLAudioElement>;

  @Input() pecId: string = '';
  @Input() pecName: string = '';
  @Input() pecStatus: string = 'DRAFT';

  pecTitle: string = 'PEC Studio';
  targetMissing = false;

  hasVideo: boolean = false;
  hasAudio: boolean = false;
  hasGpx: boolean = false;
  hasNotes: boolean = false;
  videoFileName: string = '';
  audioFileName: string = '';
  gpsFileName: string = '';
  gpsTrack: GpsPoint[] = [];
  gpsMarkers: ClickMarker[] = [];
  mapNotes: MapNote[] = [];
  captureOffset = 0;
  captureOffsetDraft: number | null = 0;
  isSavingOffset = false;

  timeOffset: number = 0;
  playbackSpeed: number = 1.0;
  activeNoteId: string | null = null;
  currentTime: number = 0;
  videoSrc: string = '';
  private videoRequest?: Subscription;
  audioSrc: string = '';

  isAddingNote: boolean = false;
  newNoteText: string = '';
  newNoteObservation: string = '';
  notes: Note[] = [];
  editingNoteId: string | null = null;
  editingNoteText: string = '';
  editingPresentationJson: string | null = null;
  isSavingNote = false;
  editingNoteObservation: string = '';
  editingNoteTimestamp: number | null = null;
  editingShiftFollowing: boolean = true;
  notebookSettings = defaultNotebook();
  notebookLoaded = false;
  notebookError = '';
  showNotebook = false;
  mobileView: 'video' | 'map' | 'notes' = 'video';
  notesWidth = 38;
  private draftInitial = '';
  get hasNoteDraft() { return !!this.editingNoteId || this.isAddingNote; }
  get editingNote() { return this.notes.find(note => note.id === this.editingNoteId); }
  private draftValue(): string {
    return JSON.stringify(this.isAddingNote ? [this.newNoteText, this.newNoteObservation] : [this.editingNoteText, this.editingNoteObservation, this.editingNoteTimestamp, this.editingPresentationJson, this.editingShiftFollowing]);
  }
  get hasUnsavedChanges() { return this.hasNoteDraft && this.draftValue() !== this.draftInitial; }
  canDeactivate(): boolean | Promise<boolean> {
    if (this.isSavingNote) return false;
    if (!this.hasUnsavedChanges) return true;
    return this.confirmDialog.confirm({ title: 'Descartar alterações?', message: 'Esta nota tem alterações por guardar.', confirmText: 'Descartar', cancelText: 'Continuar a editar', tone: 'danger' });
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent) { if (this.hasUnsavedChanges || this.isSavingNote) { event.preventDefault(); event.returnValue = ''; } }
  private focusEditor(id: string) {
    this.mobileView = 'notes';
    requestAnimationFrame(() => {
      const input = document.getElementById(id);
      if (window.innerWidth < 1100) input?.closest('.note-editor')?.scrollIntoView({ block: 'start' });
      input?.focus({ preventScroll: window.innerWidth < 1100 });
    });
  }
  cancelNewNote() {
    if (this.isSavingNote) return;
    this.isAddingNote = false; this.newNoteText = ''; this.newNoteObservation = '';
  }
  backToNotes() {
    const allowed = this.canDeactivate();
    if (allowed instanceof Promise) { void allowed.then(ok => { if (ok) this.cancelEditNote(); }); }
    else if (allowed) this.cancelEditNote();
  }

  constructor(
    private route: ActivatedRoute,
    private pecService: PecService,
    private offlineStore: OfflineRecceStoreService,
    private shared: SharedProperties,
    private confirmDialog: ConfirmDialogService,
    @Optional() private notebook?: NotebookService,
  ) {}

  ngOnInit(): void {
    this.pecId = (this.pecId || this.route.snapshot.paramMap.get('id') || '').trim();
    if (!this.pecId) {
      this.targetMissing = true;
      return;
    }
    this.pecTitle = this.pecName || `PEC ${this.pecId}`;
    this.loadNotebook();

    const localRecceData = localStorage.getItem(
      `recce_timestamps_${this.pecId}`,
    );

    if (localRecceData) {
      try {
        this.syncRecceMarkersToBackend(JSON.parse(localRecceData));
      } catch (e) {
        console.error('Erro ao ler dados do Recce do LocalStorage:', e);
        this.loadNotesFromDatabase();
      }
    } else {
      this.loadNotesFromDatabase();
    }

    this.loadAssets();
  }

  loadNotebook(): void {
    this.notebookLoaded = false;
    this.notebookError = '';
    this.notebook?.load().subscribe({
      next: settings => { this.notebookSettings = settings; this.notebookLoaded = true; },
      error: () => { this.notebookError = 'Não foi possível carregar o modelo pessoal. Tenta novamente antes de exportar.'; },
    });
  }

  get isLocked(): boolean {
    return !this.pecId || this.targetMissing || this.pecStatus === 'COMPLETED';
  }

  async syncRecceMarkersToBackend(markers: any[]): Promise<void> {
    const sessionId = localStorage.getItem(`recce_session_id_${this.pecId}`);
    const session = sessionId ? await this.offlineStore.getSession(sessionId).catch(() => null) : null;
    if (!sessionId || !session || !this.offlineStore.canAccessSession(session) || session.pecId !== this.pecId) {
      this.loadNotesFromDatabase();
      return;
    }
    markers = session.markers;
    const gpsTrack = session.gpsTrack || [];

    this.pecService.syncOfflineRecce({
      sessionId: session.id,
      deviceId: localStorage.getItem('recce_device_id') || 'browser',
      userEmail: session.userEmail,
      temporaryName: this.pecName || this.pecTitle,
      pecId: this.pecId,
      createdAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      notesCount: markers.length,
      durationSeconds: markers[markers.length - 1]?.timestamp || 0,
      markers,
      gpsTrack,
    }).subscribe({
      next: async () => {
        if (!this.offlineStore.canAccessSession(session)) return;
        const audioUploaded = await this.uploadStoredAudioForSession(sessionId);
        if (!this.offlineStore.canAccessSession(session)) return;
        if (!audioUploaded) {
          this.shared.error(
            'Notas sincronizadas, mas audio falhou',
            'O reconhecimento fica guardado localmente para tentares novamente.',
          );
        } else {
          if (localStorage.getItem(`recce_session_id_${this.pecId}`) === sessionId) {
            localStorage.removeItem(`recce_timestamps_${this.pecId}`);
            localStorage.removeItem(`recce_gps_track_${this.pecId}`);
            localStorage.removeItem(`recce_session_id_${this.pecId}`);
          }
          await this.offlineStore.deleteSession(sessionId).catch(() => undefined);
        }
        this.loadNotesFromDatabase();
        this.loadAssets();
        this.loadGpsTrack();
        this.loadRecceMarkers();
      },
      error: (err: any) => {
        if (!this.offlineStore.canAccessSession(session)) return;
        console.error('Erro ao sincronizar timestamps do recce:', err);
        this.notes = markers.map((m, idx) => ({
          id: `local-${Date.now()}-${idx}`,
          originalTimestamp: m.timestamp,
          text: m.text || `Nota Marcada ${idx + 1}`,
          speedRating: m.speedRating || m.rawText || '',
        }));
        this.hasNotes = true;
      },
    });
  }

  loadNotesFromDatabase(): void {
    this.pecService.getPecNotes(this.pecId).subscribe({
      next: (dbNotes: any[]) => this.setNotes(dbNotes),
      error: (err) => console.error('Erro ao carregar notas da BD:', err),
    });
  }

  setNotes(dbNotes: any[]): void {
    this.notes = this.sortNotesForTimeline(
      (dbNotes || []).map((n) => ({
        id: String(n.id),
        originalTimestamp: this.normalizeOptionalTimestamp(n.originalTimestamp),
        text: n.text || 'Nota sem descricao',
        speedRating: n.speedRating,
        presentationJson: n.presentationJson,
        latitude: n.latitude,
        longitude: n.longitude,
      })),
    );
    this.hasNotes = this.notes.length > 0;
    this.refreshMapNotes();
  }

  loadAssets(): void {
    this.pecService.getPecAssets(this.pecId).subscribe({
      next: (assets) => this.applyAssets(assets),
      error: (err) => console.error('Erro ao carregar ficheiros da PEC:', err),
    });
  }

  applyAssets(assets: PecAssets): void {
    this.captureOffset = assets.recceVideoOffsetSeconds ?? 0;
    this.captureOffsetDraft = this.captureOffset;
    this.hasVideo = assets.hasVideo;
    this.hasAudio = assets.hasAudio;
    this.hasGpx = assets.hasGps;
    this.videoFileName = assets.videoFileName || '';
    this.audioFileName = assets.audioFileName || '';
    this.gpsFileName = assets.gpsFileName || '';
    this.loadVideoSource(assets);
    this.loadAudioSource(assets);

    this.loadGpsTrack();
    this.loadRecceMarkers();
  }

  loadGpsTrack(): void {
    this.pecService.getGpsTrack(this.pecId).subscribe({
      next: (track) => {
        this.gpsTrack = track || [];
        this.hasGpx = this.hasGpx || this.gpsTrack.length > 0;
        this.refreshMapNotes();
      },
      error: (err) => console.error('Erro ao carregar GPS:', err),
    });
  }

  loadRecceMarkers(): void {
    this.pecService.getPecRecceMarkers(this.pecId).subscribe({
      next: (markers) => { this.gpsMarkers = markers || []; this.refreshMapNotes(); },
      error: (err) => console.error('Erro ao carregar pontos das notas:', err),
    });
  }

  refreshMapNotes(): void {
    this.mapNotes = notesOnMap(this.notes, this.gpsMarkers, trackSegments(this.gpsTrack));
  }

  selectMapNote(point: MapNote): void {
    const note = this.notes.find(note => note.id === point.id);
    if (note) this.jumpToNote(note);
  }

  saveCaptureOffset(): void {
    if (this.isLocked || this.isSavingOffset) return;
    const offset = this.captureOffsetDraft;
    if (typeof offset !== 'number' || !Number.isFinite(offset) || Math.abs(offset) > 86400) {
      this.shared.error('Desfasamento inválido', 'Usa segundos entre -86400 e 86400.');
      return;
    }
    this.isSavingOffset = true;
    this.pecService.updatePecById(this.pecId, { recceVideoOffsetSeconds: offset }).subscribe({
      next: updated => {
        this.captureOffset = updated.recceVideoOffsetSeconds ?? offset;
        this.captureOffsetDraft = this.captureOffset;
        this.isSavingOffset = false;
        this.onTimeUpdate();
        this.shared.success('Sincronização guardada');
      },
      error: () => {
        this.isSavingOffset = false;
        this.shared.error('Não foi possível guardar a sincronização');
      },
    });
  }

  onTimeUpdate(): void {
    const media = this.activeMediaElement();
    if (!media) return;
    this.currentTime = media.currentTime;

    const currentNote = [...this.notes]
      .reverse()
      .find((n) => {
        const timestamp = this.noteVideoTimestamp(n);
        return timestamp !== null && timestamp <= this.currentTime;
      });

    this.activeNoteId = currentNote?.id ?? null;
  }

  openAddNoteForm(): void {
    if (this.isLocked || this.isSavingNote) return;
    if (this.hasUnsavedChanges) { void Promise.resolve(this.canDeactivate()).then(allowed => { if (allowed) { this.cancelEditNote(); this.cancelNewNote(); this.openAddNoteForm(); } }); return; }
    this.cancelEditNote();
    const media = this.activeMediaElement();
    if (media) {
      media.pause();
      this.currentTime = media.currentTime;
    }
    this.newNoteText = '';
    this.newNoteObservation = '';
    this.isAddingNote = true;
    this.draftInitial = this.draftValue(); this.focusEditor('new-note-text');
  }

  saveNewNote(): void {
    if (!this.newNoteText.trim() || this.isLocked || this.isSavingNote) return;
    this.isSavingNote = true;

    const exactTimestamp = parseFloat(
      (this.currentTime - this.timeOffset - this.captureOffset).toFixed(1),
    );

    const newNote = {
      originalTimestamp: exactTimestamp < 0 ? 0 : exactTimestamp,
      text: this.newNoteText.trim(),
      speedRating: this.newNoteObservation.trim(),
    };

    this.pecService.saveNote(this.pecId, newNote).subscribe({
      next: (saved: any) => {
        this.isSavingNote = false;
        const savedNote: Note = {
          id: String(saved.id),
          originalTimestamp: this.normalizeOptionalTimestamp(saved.originalTimestamp),
          text: saved.text,
          speedRating: saved.speedRating,
        };
        this.notes.push(savedNote);
        this.notes = this.sortNotesForTimeline(this.notes);
        this.activeNoteId = savedNote.id;
        this.newNoteText = '';
        this.isAddingNote = false;
        this.hasNotes = true;
        this.refreshMapNotes();
        this.shared.success('Nota guardada');
      },
      error: (err) => {
        this.isSavingNote = false;
        console.error('Erro ao guardar nota:', err);
        this.shared.error('Erro ao guardar nota');
      },
    });
  }

  async deleteNote(noteId: string, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.isLocked) return;
    const note = this.notes.find((item) => item.id === noteId);
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar nota',
      message: 'Queres mesmo eliminar esta nota?',
      detail: note?.text || 'Esta nota será removida do caderno da PEC.',
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) return;

    if (noteId.startsWith('local-') || noteId.startsWith('note-')) {
      this.removeNoteFromList(noteId);
      return;
    }

    this.pecService.deleteNote(this.pecId, noteId).subscribe({
      next: () => this.removeNoteFromList(noteId),
      error: (err) => {
        console.error('Erro ao eliminar nota:', err);
        this.shared.error('Erro ao eliminar nota');
      },
    });
  }

  removeNoteFromList(noteId: string): void {
    this.notes = this.notes.filter((n) => n.id !== noteId);
    this.hasNotes = this.notes.length > 0;
    this.refreshMapNotes();
  }

  startEditNote(note: Note, event: Event): void {
    event.stopPropagation();
    if (this.isLocked || this.isSavingNote) return;
    if (this.editingNoteId === note.id) { this.focusEditor('edit-note-text'); return; }
    if (this.hasUnsavedChanges) { void Promise.resolve(this.canDeactivate()).then(allowed => { if (allowed) { this.cancelEditNote(); this.cancelNewNote(); this.startEditNote(note, new Event('click')); } }); return; }
    this.cancelNewNote();
    this.editingNoteId = note.id;
    this.editingNoteText = note.text;
    this.editingPresentationJson = note.presentationJson ?? null;
    this.editingNoteObservation = note.speedRating || '';
    this.editingNoteTimestamp = this.noteVideoTimestamp(note);
    this.editingShiftFollowing = false;
    this.draftInitial = this.draftValue(); this.focusEditor('edit-note-text');
  }

  cancelEditNote(event?: Event): void {
    event?.stopPropagation();
    if (this.isSavingNote) return;
    const previousId = this.editingNoteId;
    this.editingNoteId = null;
    this.editingNoteText = '';
    this.editingPresentationJson = null;
    this.editingNoteObservation = '';
    this.editingNoteTimestamp = null;
    this.editingShiftFollowing = false;
    if (previousId) requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-edit-note]')).find(button => button.dataset['editNote'] === previousId)?.focus({ preventScroll: true }));
  }

  saveEditedNote(note: Note, event: Event): void {
    event.stopPropagation();
    if (!note.id || !this.editingNoteText.trim() || this.isLocked || this.isSavingNote) return;
    const error = presentationError(this.editingNoteText, this.editingPresentationJson);
    if (error) { this.shared.error('Apresentação inválida', error); return; }
    if (this.editingNoteTimestamp !== null && (!Number.isFinite(this.editingNoteTimestamp) || this.editingNoteTimestamp < 0)) {
      this.shared.error('Tempo inválido', 'Usa um instante positivo ou zero, ou deixa o campo vazio.'); return;
    }

    const targetTimestamp = this.storageTimestampFromVideoTimestamp(
      this.normalizeOptionalTimestamp(this.editingNoteTimestamp),
    );
    const updatedNote: Note = {
      ...note,
      originalTimestamp: targetTimestamp,
      text: this.editingNoteText.trim(),
      speedRating: this.editingNoteObservation.trim(),
      presentationJson: this.editingPresentationJson ? JSON.stringify({ ...JSON.parse(this.editingPresentationJson), text: this.editingNoteText.trim() }) : null,
    };
    this.isSavingNote = true;

    if (this.isPersistedNoteId(note.id)) {
      this.pecService.alignNote(this.pecId, note.id, {
        targetTimestamp,
        text: updatedNote.text,
        speedRating: updatedNote.speedRating || '',
        shiftFollowing: this.editingShiftFollowing,
        presentationJson: updatedNote.presentationJson,
      }).subscribe({
        next: (savedNotes: any[]) => {
          this.isSavingNote = false;
          this.timeOffset = 0;
          this.setNotes(savedNotes);
          this.cancelEditNote();
          this.onTimeUpdate();
          this.shared.success(
            this.editingShiftFollowing ? 'Nota alinhada' : 'Nota atualizada',
          );
        },
        error: (err) => {
          this.isSavingNote = false;
          console.error('Erro ao alinhar nota:', err);
          this.shared.error('Erro ao alinhar nota');
        },
      });
      return;
    }

    this.pecService.updateNote(this.pecId, note.id, updatedNote).subscribe({
      next: (saved: any) => {
        this.isSavingNote = false;
        this.notes = this.notes.map((existing) =>
          existing.id === note.id
            ? {
                id: String(saved.id),
                originalTimestamp: this.normalizeOptionalTimestamp(saved.originalTimestamp),
                text: saved.text,
                speedRating: saved.speedRating,
                latitude: saved.latitude ?? note.latitude,
                longitude: saved.longitude ?? note.longitude,
                presentationJson: saved.presentationJson,
              }
            : existing,
        );
        this.notes = this.sortNotesForTimeline(this.notes);
        this.cancelEditNote();
        this.refreshMapNotes();
        this.shared.success('Nota atualizada');
      },
      error: (err) => {
        this.isSavingNote = false;
        console.error('Erro ao editar nota:', err);
        this.shared.error('Erro ao editar nota');
      },
    });
  }

  setEditingTimestampToCurrentTime(event: Event): void {
    event.stopPropagation();
    this.editingNoteTimestamp = this.roundTimestamp(this.currentTime);
  }

  saveEditedNoteAtCurrentTime(note: Note, event: Event): void {
    event.stopPropagation();
    this.editingNoteTimestamp = this.roundTimestamp(this.currentTime);
    this.saveEditedNote(note, event);
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;
    if (this.videoPlayer) {
      this.videoPlayer.nativeElement.playbackRate = speed;
    }
    if (this.audioPlayer) {
      this.audioPlayer.nativeElement.playbackRate = speed;
    }
  }

  setAnchorAtCurrentTime(): void {
    if (this.isLocked) return;
    const first = this.notes.find(note => note.originalTimestamp !== null);
    if (!first) return;
    this.captureOffsetDraft = this.roundTimestamp(this.currentTime - first.originalTimestamp! - this.timeOffset);
    this.saveCaptureOffset();
  }

  jumpToNote(note: Note): void {
    const targetTime = this.noteVideoTimestamp(note);
    const media = this.activeMediaElement();
    if (media && targetTime !== null && (targetTime < 0
      || (Number.isFinite(media.duration) && targetTime > media.duration))) {
      this.shared.error('Nota fora do vídeo/áudio', 'O tempo desta nota não está incluído no ficheiro. Verifica o desfasamento.');
      return;
    }
    if (media && targetTime !== null && targetTime >= 0) {
      media.currentTime = targetTime;
      this.currentTime = targetTime;
      this.activeNoteId = note.id;
      media.play();
      return;
    }
    this.activeNoteId = note.id;
  }

  noteTimeLabel(note: Note): string {
    const timestamp = this.noteVideoTimestamp(note);
    return timestamp === null ? 'sem tempo' : `${timestamp.toFixed(1)}s`;
  }

  onDownloadTemplate(): void {
    this.pecService.downloadTemplate(this.pecId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Template_Notas_PEC_${this.pecName}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Erro ao descarregar template:', err),
    });
  }

  onFileSelected(event: any): void {
    if (this.isLocked) return;
    const file: File = event.target.files[0];
    if (!file) return;

    this.pecService.uploadNotesExcel(this.pecId, file).subscribe({
      next: (importedNotes: any[]) => {
        this.setNotes(importedNotes);
        this.shared.success('Notas importadas', `${importedNotes.length} notas carregadas.`);
      },
      error: (err: any) => {
        console.error('Erro ao enviar ficheiro:', err);
        this.shared.error('Erro ao processar ficheiro Excel');
      },
    });
    event.target.value = '';
  }

  onFileSelect(event: any, type: 'video' | 'audio' | 'gpx'): void {
    if (this.isLocked) return;
    const file: File = event.target.files[0];
    if (!file) return;

    if (type === 'video') {
      this.pecService.uploadVideo(this.pecId, file).subscribe({
        next: (assets) => {
          this.applyAssets(assets);
          this.shared.success('Vídeo guardado');
        },
        error: (err) => {
          console.error('Erro ao guardar vídeo:', err);
          this.shared.error('Erro ao guardar vídeo');
        },
      });
    } else if (type === 'audio') {
      this.pecService.uploadAudio(this.pecId, file, file.name).subscribe({
        next: (assets) => {
          this.applyAssets(assets);
          this.shared.success('Áudio guardado');
        },
        error: (err) => {
          console.error('Erro ao guardar áudio:', err);
          this.shared.error('Erro ao guardar áudio');
        },
      });
    } else {
      this.pecService.uploadGps(this.pecId, file).subscribe({
        next: (assets) => {
          this.applyAssets(assets);
          this.shared.success('GPS guardado');
        },
        error: (err) => {
          console.error('Erro ao guardar GPS:', err);
          this.shared.error('Erro ao guardar GPS');
        },
      });
    }

    event.target.value = '';
  }

  async deleteVideo(): Promise<void> {
    if (this.isLocked) return;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar vídeo',
      message: 'Queres eliminar o vídeo desta PEC?',
      detail: this.videoFileName || 'O ficheiro de vídeo associado será removido.',
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.pecService.deleteVideo(this.pecId).subscribe({
      next: (assets) => {
        this.applyAssets(assets);
        this.shared.success('Vídeo eliminado');
      },
      error: (err) => {
        console.error('Erro ao eliminar vídeo:', err);
        this.shared.error('Erro ao eliminar vídeo');
      },
    });
  }

  async deleteAudio(): Promise<void> {
    if (this.isLocked) return;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar áudio',
      message: 'Queres eliminar o áudio desta PEC?',
      detail: this.audioFileName || 'O áudio gravado/importado será removido.',
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.pecService.deleteAudio(this.pecId).subscribe({
      next: (assets) => {
        this.applyAssets(assets);
        this.shared.success('Áudio eliminado');
      },
      error: (err) => {
        console.error('Erro ao eliminar áudio:', err);
        this.shared.error('Erro ao eliminar áudio');
      },
    });
  }

  ngOnDestroy(): void {
    this.videoRequest?.unsubscribe();
    this.revokeVideoSource();
    this.revokeAudioSource();
  }

  private noteVideoTimestamp(note: Note): number | null {
    if (note.originalTimestamp === null || note.originalTimestamp === undefined) {
      return null;
    }
    return this.roundTimestamp(note.originalTimestamp + this.timeOffset + this.captureOffset);
  }

  private storageTimestampFromVideoTimestamp(videoTimestamp: number | null): number | null {
    if (videoTimestamp === null) {
      return null;
    }
    return this.roundTimestamp(Math.max(0, videoTimestamp - this.timeOffset - this.captureOffset));
  }

  private normalizeOptionalTimestamp(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? this.roundTimestamp(Math.max(0, parsed)) : null;
  }

  private sortNotesForTimeline(notes: Note[]): Note[] {
    return notes
      .map((note, index) => ({ note, index }))
      .sort((left, right) => {
        const leftTime = this.noteVideoTimestamp(left.note);
        const rightTime = this.noteVideoTimestamp(right.note);

        if (leftTime === null && rightTime === null) {
          return left.index - right.index;
        }
        if (leftTime === null) {
          return 1;
        }
        if (rightTime === null) {
          return -1;
        }
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }
        return left.index - right.index;
      })
      .map((item) => item.note);
  }

  private roundTimestamp(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private isPersistedNoteId(noteId: string): boolean {
    return !noteId.startsWith('local-') && !noteId.startsWith('note-');
  }

  private activeMediaElement(): HTMLMediaElement | null {
    if (this.videoPlayer?.nativeElement && this.videoSrc) {
      return this.videoPlayer.nativeElement;
    }
    if (this.audioPlayer?.nativeElement && this.audioSrc) {
      return this.audioPlayer.nativeElement;
    }
    return null;
  }

  private loadVideoSource(assets: PecAssets): void {
    this.videoRequest?.unsubscribe();
    this.revokeVideoSource();
    if (!assets.hasVideo) return;

    this.videoRequest = this.pecService.getVideoBlob(this.pecId).subscribe({
      next: (blob) => {
        this.videoSrc = URL.createObjectURL(blob);
      },
      error: (err) => console.error('Erro ao carregar video da PEC:', err),
    });
  }

  private revokeVideoSource(): void {
    if (this.videoSrc) {
      URL.revokeObjectURL(this.videoSrc);
      this.videoSrc = '';
    }
  }

  private loadAudioSource(assets: PecAssets): void {
    this.revokeAudioSource();
    if (!assets.hasAudio) return;

    this.pecService.getAudioBlob(this.pecId).subscribe({
      next: (blob) => {
        this.revokeAudioSource();
        this.audioSrc = URL.createObjectURL(blob);
      },
      error: (err) => {
        console.error('Erro ao carregar audio da PEC:', err);
        this.audioSrc = '';
      },
    });
  }

  private revokeAudioSource(): void {
    if (this.audioSrc) {
      URL.revokeObjectURL(this.audioSrc);
      this.audioSrc = '';
    }
  }

  private async uploadStoredAudioForSession(sessionId: string): Promise<boolean> {
    const session = await this.offlineStore.getSession(sessionId).catch(() => null);
    if (!session || !this.offlineStore.canAccessSession(session)) return false;
    if (!session.audioBlobId) return true;

    const audioBlob = await this.offlineStore.getAudioBlob(session.audioBlobId);
    if (!audioBlob || !this.offlineStore.canAccessSession(session)) return false;

    try {
      await firstValueFrom(
        this.pecService.uploadAudio(
          this.pecId,
          audioBlob,
          this.audioFileNameFromMime(session.audioMimeType || audioBlob.type),
        ),
      );
      return true;
    } catch (error) {
      console.error('Erro ao enviar audio do reconhecimento:', error);
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

}
