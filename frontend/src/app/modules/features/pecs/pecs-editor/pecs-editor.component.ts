import {
  Component,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Note } from '../../../core/models/rally';
import { ClickMarker, GpsTrackPoint } from '../../../core/services/tracking.service';
import {
  GpsPoint,
  PecAssets,
  PecService,
} from '../../../core/services/pecs.service';
import { OfflineRecceStoreService } from '../../../core/services/offline-recce-store.service';
import { SharedProperties } from '../../../core/shared/shared-properties';
import { apiUrl } from '../../../core/services/api.config';

interface GpsSketchPoint {
  x: number;
  y: number;
  label: string;
  text: string;
  timestamp: number;
}

@Component({
  selector: 'app-pecs-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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

  hasVideo: boolean = false;
  hasAudio: boolean = false;
  hasGpx: boolean = false;
  hasNotes: boolean = false;
  videoFileName: string = '';
  audioFileName: string = '';
  gpsFileName: string = '';
  gpsTrack: GpsPoint[] = [];
  gpsMarkers: ClickMarker[] = [];

  timeOffset: number = 0;
  playbackSpeed: number = 1.0;
  activeNoteId: string | null = null;
  currentTime: number = 0;
  videoSrc: string = '';
  audioSrc: string = '';

  isAddingNote: boolean = false;
  newNoteText: string = '';
  newNoteObservation: string = '';
  notes: Note[] = [];
  editingNoteId: string | null = null;
  editingNoteText: string = '';
  editingNoteObservation: string = '';

  constructor(
    private route: ActivatedRoute,
    private pecService: PecService,
    private offlineStore: OfflineRecceStoreService,
    private shared: SharedProperties,
  ) {}

  ngOnInit(): void {
    this.pecId = this.pecId || this.route.snapshot.paramMap.get('id') || 'pec-1';
    this.pecTitle = this.pecName || `PEC ${this.pecId}`;

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

  get isLocked(): boolean {
    return this.pecStatus === 'COMPLETED';
  }

  syncRecceMarkersToBackend(markers: any[]): void {
    const gpsTrack = this.localGpsTrack();
    const sessionId = localStorage.getItem(`recce_session_id_${this.pecId}`)
      || `online-recce-${this.pecId}-${Date.now()}`;

    this.pecService.syncOfflineRecce({
      sessionId,
      deviceId: localStorage.getItem('recce_device_id') || 'browser',
      userEmail: localStorage.getItem('recce_auth_email'),
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
        const audioUploaded = await this.uploadStoredAudioForSession(sessionId);
        if (!audioUploaded) {
          this.shared.error(
            'Notas sincronizadas, mas audio falhou',
            'O reconhecimento fica guardado localmente para tentares novamente.',
          );
          return;
        }
        localStorage.removeItem(`recce_timestamps_${this.pecId}`);
        localStorage.removeItem(`recce_gps_track_${this.pecId}`);
        localStorage.removeItem(`recce_session_id_${this.pecId}`);
        await this.offlineStore.deleteSession(sessionId).catch(() => undefined);
        this.loadNotesFromDatabase();
        this.loadAssets();
        this.loadGpsTrack();
        this.loadRecceMarkers();
      },
      error: (err: any) => {
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
    this.notes = (dbNotes || []).map((n) => ({
      id: String(n.id),
      originalTimestamp: n.originalTimestamp,
      text: n.text || 'Nota sem descricao',
      speedRating: n.speedRating,
    }));
    this.hasNotes = this.notes.length > 0;
  }

  loadAssets(): void {
    this.pecService.getPecAssets(this.pecId).subscribe({
      next: (assets) => this.applyAssets(assets),
      error: (err) => console.error('Erro ao carregar ficheiros da PEC:', err),
    });
  }

  applyAssets(assets: PecAssets): void {
    this.hasVideo = assets.hasVideo;
    this.hasAudio = assets.hasAudio;
    this.hasGpx = assets.hasGps;
    this.videoFileName = assets.videoFileName || '';
    this.audioFileName = assets.audioFileName || '';
    this.gpsFileName = assets.gpsFileName || '';
    this.videoSrc = assets.videoUrl
      ? apiUrl(assets.videoUrl)
      : '';
    this.loadAudioSource(assets);

    this.loadGpsTrack();
    this.loadRecceMarkers();
  }

  loadGpsTrack(): void {
    this.pecService.getGpsTrack(this.pecId).subscribe({
      next: (track) => {
        this.gpsTrack = track || [];
        this.hasGpx = this.hasGpx || this.gpsTrack.length > 0;
      },
      error: (err) => console.error('Erro ao carregar GPS:', err),
    });
  }

  loadRecceMarkers(): void {
    this.pecService.getPecRecceMarkers(this.pecId).subscribe({
      next: (markers) => (this.gpsMarkers = markers || []),
      error: (err) => console.error('Erro ao carregar pontos das notas:', err),
    });
  }

  get gpsPolylinePoints(): string {
    return this.gpsTrack
      .map((point, index) => this.projectGpsPointAt(point.lat, point.lng, index, this.gpsTrack.length))
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' ');
  }

  get gpsNotePoints(): GpsSketchPoint[] {
    const markersWithGps = this.gpsMarkers
      .filter((marker) => marker.latitude !== null && marker.longitude !== null)
      .sort((a, b) => a.index - b.index);

    return markersWithGps
      .map((marker, index) => {
        const point = this.projectGpsPointAt(
          marker.latitude as number,
          marker.longitude as number,
          index,
          markersWithGps.length,
        );
        return {
          ...point,
          label: String(marker.index),
          text: marker.text || `Nota ${marker.index}`,
          timestamp: marker.timestamp,
        };
      });
  }

  get hasGpsSketch(): boolean {
    return this.gpsTrack.length > 0 || this.gpsNotePoints.length > 0;
  }

  get gpsReferencePoint(): { lat: number; lng: number } | null {
    if (this.gpsTrack.length > 0) {
      return { lat: this.gpsTrack[0].lat, lng: this.gpsTrack[0].lng };
    }

    const marker = this.gpsMarkers.find((item) => item.latitude !== null && item.longitude !== null);
    return marker ? { lat: marker.latitude as number, lng: marker.longitude as number } : null;
  }

  get isGpsFlatSketch(): boolean {
    return this.hasGpsSketch && this.isGpsFlat(this.gpsBounds());
  }

  onTimeUpdate(): void {
    const media = this.activeMediaElement();
    if (!media) return;
    this.currentTime = media.currentTime;

    const currentNote = [...this.notes]
      .reverse()
      .find((n) => n.originalTimestamp + this.timeOffset <= this.currentTime);

    if (currentNote) {
      this.activeNoteId = currentNote.id;
    }
  }

  openAddNoteForm(): void {
    if (this.isLocked) return;
    const media = this.activeMediaElement();
    if (media) {
      media.pause();
      this.currentTime = media.currentTime;
    }
    this.newNoteText = '';
    this.newNoteObservation = '';
    this.isAddingNote = true;
  }

  saveNewNote(): void {
    if (!this.newNoteText.trim()) return;

    const exactTimestamp = parseFloat(
      (this.currentTime - this.timeOffset).toFixed(1),
    );

    const newNote = {
      originalTimestamp: exactTimestamp < 0 ? 0 : exactTimestamp,
      text: this.newNoteText.trim(),
      speedRating: this.newNoteObservation.trim(),
    };

    this.pecService.saveNote(this.pecId, newNote).subscribe({
      next: (saved: any) => {
        const savedNote: Note = {
          id: String(saved.id),
          originalTimestamp: saved.originalTimestamp,
          text: saved.text,
          speedRating: saved.speedRating,
        };
        this.notes.push(savedNote);
        this.notes.sort((a, b) => a.originalTimestamp - b.originalTimestamp);
        this.activeNoteId = savedNote.id;
        this.newNoteText = '';
        this.isAddingNote = false;
        this.hasNotes = true;
        this.shared.success('Nota guardada');
      },
      error: (err) => {
        console.error('Erro ao guardar nota:', err);
        this.shared.error('Erro ao guardar nota');
      },
    });
  }

  deleteNote(noteId: string, event: Event): void {
    event.stopPropagation();
    if (this.isLocked) return;
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
  }

  startEditNote(note: Note, event: Event): void {
    event.stopPropagation();
    if (this.isLocked) return;
    this.editingNoteId = note.id;
    this.editingNoteText = note.text;
    this.editingNoteObservation = note.speedRating || '';
  }

  cancelEditNote(event?: Event): void {
    event?.stopPropagation();
    this.editingNoteId = null;
    this.editingNoteText = '';
    this.editingNoteObservation = '';
  }

  saveEditedNote(note: Note, event: Event): void {
    event.stopPropagation();
    if (!note.id || !this.editingNoteText.trim() || this.isLocked) return;

    const updatedNote: Note = {
      ...note,
      text: this.editingNoteText.trim(),
      speedRating: this.editingNoteObservation.trim(),
    };

    this.pecService.updateNote(this.pecId, note.id, updatedNote).subscribe({
      next: (saved: any) => {
        this.notes = this.notes.map((existing) =>
          existing.id === note.id
            ? {
                id: String(saved.id),
                originalTimestamp: saved.originalTimestamp,
                text: saved.text,
                speedRating: saved.speedRating,
              }
            : existing,
        );
        this.cancelEditNote();
        this.shared.success('Nota atualizada');
      },
      error: (err) => {
        console.error('Erro ao editar nota:', err);
        this.shared.error('Erro ao editar nota');
      },
    });
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
    if (this.notes.length === 0 || this.isLocked) return;
    const offsetToApply = parseFloat(
      (this.currentTime - this.notes[0].originalTimestamp).toFixed(1),
    );

    this.pecService.applyNotesOffset(this.pecId, offsetToApply).subscribe({
      next: (updatedNotes: any[]) => {
        this.timeOffset = 0;
        this.setNotes(updatedNotes);
        this.onTimeUpdate();
        this.shared.success('Offset guardado');
      },
      error: (err) => {
        console.error('Erro ao aplicar offset:', err);
        this.shared.error('Erro ao guardar offset das notas');
      },
    });
  }

  jumpToNote(note: Note): void {
    const targetTime = note.originalTimestamp + this.timeOffset;
    const media = this.activeMediaElement();
    if (media && targetTime >= 0) {
      media.currentTime = targetTime;
      media.play();
    }
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
          this.shared.success('Video guardado');
        },
        error: (err) => {
          console.error('Erro ao guardar video:', err);
          this.shared.error('Erro ao guardar video');
        },
      });
    } else if (type === 'audio') {
      this.pecService.uploadAudio(this.pecId, file, file.name).subscribe({
        next: (assets) => {
          this.applyAssets(assets);
          this.shared.success('Audio guardado');
        },
        error: (err) => {
          console.error('Erro ao guardar audio:', err);
          this.shared.error('Erro ao guardar audio');
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

  deleteVideo(): void {
    if (this.isLocked) return;
    this.pecService.deleteVideo(this.pecId).subscribe({
      next: (assets) => {
        this.applyAssets(assets);
        this.shared.success('Video eliminado');
      },
      error: (err) => {
        console.error('Erro ao eliminar video:', err);
        this.shared.error('Erro ao eliminar video');
      },
    });
  }

  deleteAudio(): void {
    if (this.isLocked) return;
    this.pecService.deleteAudio(this.pecId).subscribe({
      next: (assets) => {
        this.applyAssets(assets);
        this.shared.success('Audio eliminado');
      },
      error: (err) => {
        console.error('Erro ao eliminar audio:', err);
        this.shared.error('Erro ao eliminar audio');
      },
    });
  }

  ngOnDestroy(): void {
    this.revokeAudioSource();
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
    if (!session?.audioBlobId) return true;

    const audioBlob = await this.offlineStore.getAudioBlob(session.audioBlobId);
    if (!audioBlob) return true;

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

  private projectGpsPointAt(lat: number, lng: number, sequenceIndex: number, sequenceTotal: number): { x: number; y: number } {
    const bounds = this.gpsBounds();
    const width = 100;
    const height = 100;
    const padding = 7;
    const flatGps = this.isGpsFlat(bounds);
    if (flatGps) {
      const ratio = sequenceTotal <= 1 ? 0.5 : sequenceIndex / (sequenceTotal - 1);
      return {
        x: padding + ratio * (width - padding * 2),
        y: height / 2,
      };
    }

    const lngSpan = bounds.maxLng - bounds.minLng || 0.000001;
    const latSpan = bounds.maxLat - bounds.minLat || 0.000001;

    return {
      x: padding + ((lng - bounds.minLng) / lngSpan) * (width - padding * 2),
      y: height - padding - ((lat - bounds.minLat) / latSpan) * (height - padding * 2),
    };
  }

  private gpsBounds(): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    const trackPoints = this.gpsTrack.map((point) => ({ lat: point.lat, lng: point.lng }));
    const markerPoints = this.gpsMarkers
      .filter((marker) => marker.latitude !== null && marker.longitude !== null)
      .map((marker) => ({ lat: marker.latitude as number, lng: marker.longitude as number }));
    const points = [...trackPoints, ...markerPoints];

    if (points.length === 0) {
      return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
    }

    return points.reduce((bounds, point) => ({
      minLat: Math.min(bounds.minLat, point.lat),
      maxLat: Math.max(bounds.maxLat, point.lat),
      minLng: Math.min(bounds.minLng, point.lng),
      maxLng: Math.max(bounds.maxLng, point.lng),
    }), {
      minLat: points[0].lat,
      maxLat: points[0].lat,
      minLng: points[0].lng,
      maxLng: points[0].lng,
    });
  }

  private isGpsFlat(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): boolean {
    return Math.abs(bounds.maxLat - bounds.minLat) < 0.00001
      && Math.abs(bounds.maxLng - bounds.minLng) < 0.00001;
  }

  private localGpsTrack(): GpsTrackPoint[] {
    const raw = localStorage.getItem(`recce_gps_track_${this.pecId}`);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}
