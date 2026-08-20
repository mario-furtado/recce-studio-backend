import {
  Component,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ClickMarker,
  TrackingService,
} from '../../core/services/tracking.service';
import {
  ParsedRecceNote,
  RecceNoteParserService,
} from '../../core/services/recce-note-parser.service';
import { SharedProperties } from '../../core/shared/shared-properties';
import {
  OfflineRecceSession,
  OfflineRecceStoreService,
} from '../../core/services/offline-recce-store.service';
import { PecService } from '../../core/services/pecs.service';
import { firstValueFrom } from 'rxjs';

interface PendingVoiceNote {
  parsed: ParsedRecceNote;
  confidence: number | null;
  receivedAt: number;
}

@Component({
  selector: 'app-recce-mode',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recce-mode.component.html',
  styleUrls: ['./recce-mode.component.css'],
})
export class RecceModeComponent implements OnInit, OnDestroy {
  @Input() pecId: string = '';
  @Input() pecName: string = ''; // Recebe o nome da PEC do componente pai

  // Output para avisar o componente pai (PecDetailComponent) para mudar a tab para STUDIO
  @Output() navigateToStudio = new EventEmitter<void>();

  isRecording = false;
  isWaitingGps = false;
  lastMarker: ClickMarker | null = null;
  totalClicks = 0;
  elapsedTimeString = '00:00.0';
  audioStatus = 'Microfone pronto';
  speechStatus = 'Transcricao pronta';
  liveTranscript = '';
  lastVoiceNote = '';
  speechSupported = false;
  audioSupported = false;
  isPushToTalkActive = false;
  private timerInterval: any;
  private recordingStartedAt = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private recognition: any = null;
  private shouldKeepRecognitionAlive = false;
  private cueAudioContext: AudioContext | null = null;
  private pendingVoiceNote: PendingVoiceNote | null = null;
  private awaitingVoiceMarkerIndex: number | null = null;
  private awaitingVoiceMarkerAt = 0;
  private pushToTalkRawText = '';
  private pushToTalkPointerId: number | null = null;
  private lastInterimTranscript = '';
  private offlineSessionId: string | null = null;
  private resumeSession: OfflineRecceSession | null = null;
  private offlineSaveQueue: Promise<unknown> = Promise.resolve();
  private readonly voiceAttachWindowMs = 8500;

  constructor(
    public trackingService: TrackingService,
    private route: ActivatedRoute,
    private router: Router,
    private noteParser: RecceNoteParserService,
    private shared: SharedProperties,
    private offlineStore: OfflineRecceStoreService,
    private pecService: PecService,
  ) {}

  ngOnInit(): void {
    if (!this.pecId) {
      this.pecId = this.route.snapshot.paramMap.get('id') || 'nova-pec';
    }
    this.loadResumeSession();
    this.audioSupported = !!navigator.mediaDevices?.getUserMedia && 'MediaRecorder' in window;
    this.speechSupported = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!this.audioSupported) {
      this.audioStatus = 'Audio indisponivel';
    }

    if (!this.speechSupported) {
      this.speechStatus = 'Transcricao indisponivel neste browser';
    }
  }

  async toggleRecording(): Promise<void> {
    if (!this.isRecording) {
      this.isWaitingGps = true;
      this.primeAudioCue();

      const gpsReady = await this.trackingService.requestGpsAndStart(
        this.resumeSession?.markers || [],
        this.resumeSession?.durationSeconds || 0,
        this.resumeSession?.gpsTrack || [],
      );
      const audioReady = gpsReady ? await this.startAudioCapture() : false;
      this.isWaitingGps = false;

      if (gpsReady) {
        this.isRecording = true;
        this.resetVoiceBuffers();
        await this.startOfflineSession();
        this.restoreResumeCounters();
        this.startTimer(this.resumeSession?.durationSeconds || 0);
        if (audioReady) {
          this.audioStatus = 'Audio a gravar';
        }
        if (this.isAlwaysActiveVoiceMode()) {
          this.startSpeechRecognition();
        } else {
          this.speechStatus = this.speechSupported ? 'Push to talk pronto' : 'Transcricao indisponivel neste browser';
        }
      }
    } else {
      // FINALIZAR PEC
      this.isRecording = false;
      this.stopTimer();
      this.stopSpeechRecognition();
      this.resetVoiceBuffers();
      const audioBlob = await this.stopAudioCapture();

      const finalMarkers = this.trackingService.stopRecce();
      const finalGpsTrack = this.trackingService.getGpsTrack();
      const completedSession = await this.completeOfflineSession(finalMarkers, audioBlob);
      const syncStatus = await this.syncCompletedSessionIfOnline(
        completedSession,
        finalMarkers,
        finalGpsTrack,
        audioBlob,
      );

      if (syncStatus === 'offline') {
        this.storeLocalCompletion(finalMarkers, finalGpsTrack, completedSession?.id || null);
      }

      if (syncStatus === 'offline' && this.shouldNavigateToOfflineQueue()) {
        this.router.navigate(['/offline-recces']);
        return;
      }

      this.navigateToStudio.emit();
    }
  }

  onMarkerPointerDown(event: PointerEvent): void {
    event.preventDefault();
    if (!this.isRecording) return;

    if (this.isAlwaysActiveVoiceMode()) {
      this.markTimestamp();
      return;
    }

    this.startPushToTalkNote(event);
  }

  onMarkerPointerUp(event: PointerEvent): void {
    if (!this.isPushToTalkMode()) return;
    event.preventDefault();
    this.finishPushToTalkNote(event);
  }

  onMarkerPointerCancel(event: PointerEvent): void {
    if (!this.isPushToTalkMode()) return;
    this.finishPushToTalkNote(event);
  }

  onMarkerPointerLeave(event: PointerEvent): void {
    if (!this.isPushToTalkMode() || event.pointerId !== this.pushToTalkPointerId) return;
    this.finishPushToTalkNote(event);
  }

  markerButtonLabel(): string {
    if (!this.isRecording) return 'INICIE A PEC';
    if (this.isAlwaysActiveVoiceMode()) return 'MARCAR NOTA';
    return this.isPushToTalkActive ? 'A OUVIR NOTA' : 'SEGURE PARA DITAR';
  }

  markerButtonHint(): string {
    if (this.isAlwaysActiveVoiceMode()) return 'Toque para registar timestamp';
    return this.isPushToTalkActive ? 'Solte para fechar a nota' : 'Timestamp ao premir, voz ate soltar';
  }

  private markTimestamp(noteData?: Partial<ClickMarker>): ClickMarker | null {
    if (!this.isRecording) return null;

    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    const pendingNote = noteData ? null : this.consumePendingVoiceNote();
    const markerNumber = this.trackingService.markers.length + 1;
    this.lastMarker = this.trackingService.registerClick(
      noteData
        ? noteData
        : pendingNote
        ? this.noteDataFromPending(pendingNote)
        : {
            text: `Nota Marcada ${markerNumber}`,
            source: 'manual',
          },
    );

    if (!this.lastMarker) return null;

    this.totalClicks = this.trackingService.markers.length;
    this.awaitingVoiceMarkerIndex = pendingNote ? null : this.lastMarker.index;
    this.awaitingVoiceMarkerAt = pendingNote ? 0 : Date.now();
    this.lastVoiceNote = pendingNote?.parsed.compactText || this.lastVoiceNote;
    this.speechStatus = pendingNote ? 'Nota anexada' : 'Timestamp marcado';
    this.playNoteCue();
    this.persistOfflineSnapshot();
    return this.lastMarker;
  }

  private primeAudioCue(): void {
    try {
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextConstructor) return;

      this.cueAudioContext = this.cueAudioContext || new AudioContextConstructor();
      if (this.cueAudioContext.state === 'suspended') {
        this.cueAudioContext.resume();
      }
    } catch (error) {
      console.warn('Feedback audio indisponivel:', error);
    }
  }

  private playNoteCue(): void {
    try {
      this.primeAudioCue();
      if (!this.cueAudioContext) return;

      const now = this.cueAudioContext.currentTime;
      const oscillator = this.cueAudioContext.createOscillator();
      const gain = this.cueAudioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.045);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

      oscillator.connect(gain);
      gain.connect(this.cueAudioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.11);
    } catch (error) {
      console.warn('Erro ao tocar feedback audio:', error);
    }
  }

  private async startAudioCapture(): Promise<boolean> {
    if (!this.audioSupported) return false;

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      const mimeType = this.preferredAudioMimeType();
      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.audioStream, { mimeType })
        : new MediaRecorder(this.audioStream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start(1000);
      return true;
    } catch (error) {
      console.error('Erro ao aceder ao microfone:', error);
      this.audioStatus = 'Microfone bloqueado';
      this.shared.error('Microfone indisponivel', 'Autorize o microfone para gravar audio do reconhecimento.');
      return false;
    }
  }

  private stopAudioCapture(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const recorder = this.mediaRecorder;
      if (!recorder) {
        this.stopAudioTracks();
        return resolve(null);
      }

      recorder.onstop = () => {
        const blob = this.audioChunks.length
          ? new Blob(this.audioChunks, { type: recorder.mimeType || 'audio/webm' })
          : null;
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.stopAudioTracks();
        this.audioStatus = blob ? 'Audio guardado' : 'Sem audio gravado';
        resolve(blob);
      };

      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        recorder.onstop(new Event('stop'));
      }
    });
  }

  private stopAudioTracks(): void {
    this.audioStream?.getTracks().forEach((track) => track.stop());
    this.audioStream = null;
  }

  private preferredAudioMimeType(): string | undefined {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];

    return candidates.find((mimeType) => MediaRecorder.isTypeSupported?.(mimeType));
  }

  private startSpeechRecognition(): void {
    if (!this.speechSupported || !this.isRecording) return;
    this.stopSpeechRecognition();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'pt-PT';
    this.recognition.continuous = this.isAlwaysActiveVoiceMode();
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.shouldKeepRecognitionAlive = this.isAlwaysActiveVoiceMode();
    this.speechStatus = this.isPushToTalkMode() ? 'A ouvir nota' : 'A ouvir notas';

    this.recognition.onresult = (event: any) => this.handleSpeechResult(event);
    this.recognition.onerror = (event: any) => {
      console.error('Erro na transcricao:', event);
      this.speechStatus = event?.error === 'not-allowed' ? 'Transcricao bloqueada' : 'Transcricao interrompida';
    };
    this.recognition.onend = () => {
      if (this.shouldKeepRecognitionAlive && this.isRecording) {
        window.setTimeout(() => {
          try {
            this.recognition?.start();
          } catch {
            this.speechStatus = 'Transcricao em espera';
          }
        }, 350);
      }
    };

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Erro ao iniciar transcricao:', error);
      this.speechStatus = 'Transcricao em espera';
    }
  }

  private stopSpeechRecognition(): void {
    this.shouldKeepRecognitionAlive = false;
    if (!this.recognition) return;

    try {
      this.recognition.stop();
    } catch {
      this.recognition.abort?.();
    }
    this.recognition = null;
    this.liveTranscript = '';
  }

  private handleSpeechResult(event: any): void {
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index];
      const transcript = String(result[0]?.transcript || '').trim();
      if (!transcript) continue;

      if (result.isFinal) {
        this.prepareVoiceNote(transcript, result[0]?.confidence ?? null);
      } else {
        this.liveTranscript = transcript;
        this.lastInterimTranscript = transcript;
      }
    }
  }

  private prepareVoiceNote(rawText: string, confidence: number | null): void {
    if (!this.isRecording) return;

    const textToParse = this.shouldAttachToAwaitingMarker() && this.isPushToTalkMode()
      ? this.appendPushToTalkText(rawText)
      : rawText;
    const parsed = this.noteParser.parse(textToParse);
    const pending: PendingVoiceNote = {
      parsed,
      confidence,
      receivedAt: Date.now(),
    };

    let attachedToMarker = false;
    if (this.shouldAttachToAwaitingMarker()) {
      const marker = this.trackingService.updateMarker(
        this.awaitingVoiceMarkerIndex as number,
        this.noteDataFromPending(pending),
      );

      if (marker) {
        this.lastMarker = marker;
        if (!this.isPushToTalkActive) {
          this.awaitingVoiceMarkerIndex = null;
          this.awaitingVoiceMarkerAt = 0;
          this.pushToTalkRawText = '';
        }
        attachedToMarker = true;
        this.persistOfflineSnapshot();
      }
    } else {
      this.pendingVoiceNote = pending;
    }

    this.lastVoiceNote = parsed.compactText;
    this.liveTranscript = '';
    this.speechStatus = attachedToMarker ? 'Nota anexada' : 'Nota pronta';

    if ('vibrate' in navigator) {
      navigator.vibrate(35);
    }
  }

  private consumePendingVoiceNote(): PendingVoiceNote | null {
    if (!this.pendingVoiceNote) return null;

    const pending = this.pendingVoiceNote;
    this.pendingVoiceNote = null;
    return pending;
  }

  private shouldAttachToAwaitingMarker(): boolean {
    if (this.awaitingVoiceMarkerIndex === null) return false;
    if (this.isPushToTalkActive) return true;
    return Date.now() - this.awaitingVoiceMarkerAt <= this.voiceAttachWindowMs;
  }

  private noteDataFromPending(pending: PendingVoiceNote): Partial<ClickMarker> {
    return {
      text: pending.parsed.compactText,
      rawText: pending.parsed.rawText,
      speedRating: pending.parsed.observation,
      source: 'voice',
      audioConfidence: pending.confidence,
    };
  }

  private resetVoiceBuffers(): void {
    this.pendingVoiceNote = null;
    this.awaitingVoiceMarkerIndex = null;
    this.awaitingVoiceMarkerAt = 0;
    this.pushToTalkRawText = '';
    this.pushToTalkPointerId = null;
    this.isPushToTalkActive = false;
    this.liveTranscript = '';
    this.lastVoiceNote = '';
  }

  private startPushToTalkNote(event: PointerEvent): void {
    if (this.isPushToTalkActive) return;

    const marker = this.markTimestamp();
    if (!marker) return;

    this.isPushToTalkActive = true;
    this.pushToTalkPointerId = event.pointerId;
    this.awaitingVoiceMarkerIndex = marker.index;
    this.awaitingVoiceMarkerAt = Date.now();
    this.pushToTalkRawText = '';
    this.lastInterimTranscript = '';
    this.liveTranscript = '';
    this.speechStatus = this.speechSupported ? 'A ouvir nota' : 'Timestamp marcado';

    const target = event.currentTarget as HTMLElement | null;
    try {
      target?.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers do not allow capture for every pointer source.
    }

    if (this.speechSupported) {
      this.startSpeechRecognition();
    }
  }

  private finishPushToTalkNote(event?: PointerEvent): void {
    if (!this.isPushToTalkActive) return;

    const target = event?.currentTarget as HTMLElement | null;
    if (event && this.pushToTalkPointerId === event.pointerId) {
      try {
        target?.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released.
      }
    }

    const fallbackTranscript = (this.liveTranscript || this.lastInterimTranscript).trim();
    if (fallbackTranscript) {
      this.prepareVoiceNote(fallbackTranscript, null);
    }

    this.stopSpeechRecognition();
    this.isPushToTalkActive = false;
    this.pushToTalkPointerId = null;
    this.awaitingVoiceMarkerAt = Date.now();
    if (this.speechSupported) {
      this.speechStatus = this.liveTranscript ? 'Nota a fechar' : 'Nota marcada';
    }
  }

  private isPushToTalkMode(): boolean {
    return this.shared.voiceCaptureMode$.value === 'push-to-talk';
  }

  private isAlwaysActiveVoiceMode(): boolean {
    return this.shared.voiceCaptureMode$.value === 'always-active';
  }

  private appendPushToTalkText(rawText: string): string {
    const nextText = rawText.trim();
    if (!nextText) return this.pushToTalkRawText;

    const currentKey = this.transcriptKey(this.pushToTalkRawText);
    const nextKey = this.transcriptKey(nextText);

    if (currentKey === nextKey) {
      return this.pushToTalkRawText;
    }

    if (nextKey.startsWith(currentKey)) {
      this.pushToTalkRawText = nextText;
      return this.pushToTalkRawText;
    }

    if (currentKey.startsWith(nextKey)) {
      return this.pushToTalkRawText;
    }

    const mergedText = this.mergeOverlappingTranscript(this.pushToTalkRawText, nextText);
    this.pushToTalkRawText = mergedText || nextText;
    return this.pushToTalkRawText;
  }

  private mergeOverlappingTranscript(currentText: string, nextText: string): string {
    const currentTokens = currentText.split(/\s+/).filter(Boolean);
    const nextTokens = nextText.split(/\s+/).filter(Boolean);
    if (currentTokens.length === 0) return nextText;

    const currentKeys = currentTokens.map((token) => this.transcriptTokenKey(token));
    const nextKeys = nextTokens.map((token) => this.transcriptTokenKey(token));
    const maxOverlap = Math.min(currentKeys.length, nextKeys.length);

    for (let size = maxOverlap; size > 0; size--) {
      const currentTail = currentKeys.slice(currentKeys.length - size);
      const nextHead = nextKeys.slice(0, size);
      if (currentTail.every((token, index) => token === nextHead[index])) {
        return [...currentTokens, ...nextTokens.slice(size)].join(' ');
      }
    }

    return `${currentText} ${nextText}`.trim();
  }

  private transcriptKey(text: string): string {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => this.transcriptTokenKey(token))
      .join(' ');
  }

  private transcriptTokenKey(token: string): string {
    const normalized = token
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    if (['e', 'esq', 'esquerda'].includes(normalized)) return 'esquerda';
    if (['d', 'dir', 'direita'].includes(normalized)) return 'direita';
    if (normalized === 'tres') return '3';
    return normalized;
  }

  private async startOfflineSession(): Promise<void> {
    try {
      if (this.resumeSession?.status === 'draft') {
        this.offlineSessionId = this.resumeSession.id;
        this.shared.info('Reconhecimento offline retomado', 'A sessao local voltou a ficar ativa.');
        return;
      }

      const session = await this.offlineStore.createSession({
        pecId: this.isStandaloneOfflineRecce() ? undefined : this.pecId,
        pecName: this.pecName || undefined,
      });
      this.offlineSessionId = session.id;
      if (this.shouldAnnounceOfflineSession()) {
        this.shared.info('Reconhecimento offline preparado', 'A sessao esta a ser guardada neste dispositivo.');
      }
    } catch (error) {
      console.error('Erro ao criar sessao offline:', error);
      this.shared.error('Erro no armazenamento offline', 'O reconhecimento continua, mas pode nao ficar guardado no dispositivo.');
    }
  }

  private persistOfflineSnapshot(): void {
    if (!this.offlineSessionId) return;

    const sessionId = this.offlineSessionId;
    const markers = [...this.trackingService.markers];
    const gpsTrack = this.trackingService.getGpsTrack();
    this.offlineSaveQueue = this.offlineSaveQueue.then(() =>
      this.offlineStore.saveSnapshot(sessionId, markers, gpsTrack),
    ).catch((error) => {
      console.error('Erro ao guardar snapshot offline:', error);
    });
  }

  private async completeOfflineSession(markers: ClickMarker[], audioBlob: Blob | null): Promise<OfflineRecceSession | null> {
    if (!this.offlineSessionId) return null;

    try {
      await this.offlineSaveQueue;
      return await this.offlineStore.completeSession(this.offlineSessionId, markers, audioBlob, this.trackingService.getGpsTrack());
    } catch (error) {
      console.error('Erro ao fechar sessao offline:', error);
      this.shared.error('Erro ao guardar offline', 'O JSON de backup foi descarregado como alternativa.');
      return null;
    } finally {
      this.offlineSessionId = null;
    }
  }

  private async syncCompletedSessionIfOnline(
    session: OfflineRecceSession | null,
    markers: ClickMarker[],
    gpsTrack: ReturnType<TrackingService['getGpsTrack']>,
    audioBlob: Blob | null,
  ): Promise<'synced' | 'partial' | 'offline'> {
    if (!session || !this.shouldSyncImmediately()) {
      this.shared.success('Reconhecimento guardado offline', 'Fica disponivel para sincronizar quando estiver online.');
      return 'offline';
    }

    try {
      const response = await firstValueFrom(
        this.pecService.syncOfflineRecce({
          sessionId: session.id,
          deviceId: session.deviceId,
          userEmail: session.userEmail,
          temporaryName: session.temporaryName,
          pecId: this.pecId,
          createdAt: session.createdAt,
          finishedAt: session.finishedAt,
          notesCount: markers.length,
          durationSeconds: session.durationSeconds,
          markers,
          gpsTrack,
        }),
      );

      const audioUploaded = await this.uploadAudioBlob(response.pecId, audioBlob);
      if (!audioUploaded) {
        await this.offlineStore.markSessionReadyToSync(
          session.id,
          'Notas e GPS sincronizados, mas falhou o envio do audio.',
        );
        this.shared.error(
          'Audio nao sincronizado',
          'Notas e GPS foram guardados no backend. O audio fica local para tentar novamente.',
        );
        return 'partial';
      }

      await this.offlineStore.deleteSession(session.id);
      this.clearLocalCompletion();
      this.shared.success('Reconhecimento sincronizado', response.pecName || response.pecId);
      return 'synced';
    } catch (error) {
      console.error('Erro ao sincronizar reconhecimento online:', error);
      await this.offlineStore.markSessionReadyToSync(
        session.id,
        'Falha ao enviar para o backend.',
      );
      this.shared.success('Reconhecimento guardado offline', 'Nao foi possivel contactar o backend. Podes sincronizar depois.');
      return 'offline';
    }
  }

  private async uploadAudioBlob(pecId: string, audioBlob: Blob | null): Promise<boolean> {
    if (!audioBlob) return true;

    try {
      await firstValueFrom(
        this.pecService.uploadAudio(
          pecId,
          audioBlob,
          this.audioFileNameFromMime(audioBlob.type),
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

  private storeLocalCompletion(
    markers: ClickMarker[],
    gpsTrack: ReturnType<TrackingService['getGpsTrack']>,
    sessionId: string | null,
  ): void {
    localStorage.setItem(`recce_timestamps_${this.pecId}`, JSON.stringify(markers));
    localStorage.setItem(`recce_gps_track_${this.pecId}`, JSON.stringify(gpsTrack));
    if (sessionId) {
      localStorage.setItem(`recce_session_id_${this.pecId}`, sessionId);
    }
  }

  private clearLocalCompletion(): void {
    localStorage.removeItem(`recce_timestamps_${this.pecId}`);
    localStorage.removeItem(`recce_gps_track_${this.pecId}`);
    localStorage.removeItem(`recce_session_id_${this.pecId}`);
  }

  private shouldSyncImmediately(): boolean {
    return this.shared.connectionMode$.value === 'online'
      && (typeof navigator === 'undefined' || navigator.onLine)
      && !this.isStandaloneOfflineRecce()
      && !this.resumeSession;
  }

  private isStandaloneOfflineRecce(): boolean {
    return !this.pecId || this.pecId === 'nova-pec';
  }

  private shouldNavigateToOfflineQueue(): boolean {
    return this.shared.connectionMode$.value === 'offline'
      || this.isStandaloneOfflineRecce()
      || !!this.resumeSession;
  }

  private shouldAnnounceOfflineSession(): boolean {
    return this.shared.connectionMode$.value === 'offline'
      || this.isStandaloneOfflineRecce()
      || !!this.resumeSession;
  }

  private loadResumeSession(): void {
    const sessionId = this.route.snapshot.queryParamMap.get('offlineSessionId');
    if (!sessionId) return;

    this.offlineStore.getSession(sessionId)
      .then((session) => {
        if (!session || session.status !== 'draft') {
          this.shared.error('Sessao indisponivel', 'So reconhecimentos em rascunho podem ser continuados.');
          return;
        }

        this.resumeSession = session;
        this.offlineSessionId = session.id;
        this.pecId = session.pecId || this.pecId;
        this.pecName = session.pecName || session.temporaryName;
        this.totalClicks = session.notesCount;
        this.lastMarker = session.markers[session.markers.length - 1] || null;
        this.elapsedTimeString = this.formatElapsed(session.durationSeconds);
        this.speechStatus = 'Sessao offline carregada';
      })
      .catch((error) => {
        console.error('Erro ao carregar sessao offline:', error);
        this.shared.error('Erro ao carregar sessao offline');
      });
  }

  private restoreResumeCounters(): void {
    if (!this.resumeSession) return;

    this.totalClicks = this.resumeSession.notesCount;
    this.lastMarker = this.resumeSession.markers[this.resumeSession.markers.length - 1] || null;
    this.elapsedTimeString = this.formatElapsed(this.resumeSession.durationSeconds);
  }

  private formatElapsed(totalSeconds: number): string {
    const seconds = Math.floor(totalSeconds);
    const mins = Math.floor(seconds / 60);
    const remSecs = seconds % 60;
    const tenths = Math.floor((totalSeconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}.${tenths}`;
  }

  private startTimer(initialElapsedSeconds = 0): void {
    this.recordingStartedAt = Date.now() - Math.max(0, initialElapsedSeconds) * 1000;
    this.timerInterval = setInterval(() => {
      const diff = Date.now() - this.recordingStartedAt;
      const seconds = Math.floor(diff / 1000);
      const mins = Math.floor(seconds / 60);
      const remSecs = seconds % 60;
      const tenths = Math.floor((diff % 1000) / 100);
      this.elapsedTimeString = `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}.${tenths}`;
    }, 100);
  }

  private stopTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.stopSpeechRecognition();
    this.stopAudioCapture();
    this.resetVoiceBuffers();
    this.cueAudioContext?.close();
    this.trackingService.stopRecce();
  }
}
