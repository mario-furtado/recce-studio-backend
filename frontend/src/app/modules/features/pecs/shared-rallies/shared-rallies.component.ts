import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { NotebookComponent, PublishedNotebook } from '../../../core/notebook/notebook.component';
import { NotebookSettings } from '../../../core/notebook/notebook.model';
import { API_BASE_URL } from '../../../core/services/api.config';
import { AuthService } from '../../../core/services/auth.service';
import { GpsPoint } from '../../../core/services/pecs.service';
import { RecceMapComponent } from '../pecs-editor/recce-map.component';
import { MapNote, validCoordinate } from '../pecs-editor/gps-timeline';
import { RallyAreaNavComponent } from '../rally-area-nav.component';

interface Rally {
  id: string;
  name: string;
  status: string;
  surface: string;
}

interface Stage {
  id: string;
  number: number;
  name: string;
  distanceKm: number;
}

interface SharedNote {
  id: number;
  text: string;
  speedRating: string | null;
  originalTimestamp: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface StageView {
  pec: Stage;
  hasVideo: boolean;
  hasAudio: boolean;
  notes: SharedNote[];
}

@Component({
  selector: 'app-shared-rallies',
  imports: [CommonModule, RouterLink, NotebookComponent, RecceMapComponent, RallyAreaNavComponent],
  templateUrl: './shared-rallies.component.html',
  styles: [`
    :host{display:block;max-width:72rem;margin:auto}
    .read-card{min-width:0;padding:1rem;border:1px solid var(--border);border-radius:.75rem}
    .read-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem}
    .read-meta{color:var(--text-muted,#bec7d4)}
    audio,video{display:block;width:100%;min-width:0;max-height:32rem}
  `],
})
export class SharedRalliesComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly session = this.auth.getToken();
  private navigation?: Subscription;
  private requests = new Subscription();
  private endpoint = '';
  rallyId = '';
  pecId = '';
  loading = true;
  checkingAccess = false;
  sessionChanged = false;
  error = '';
  rallies: Rally[] = [];
  rally?: Rally & { pecs: Stage[] };
  stage?: StageView;
  track?: GpsPoint[];
  mapNotes: MapNote[] = [];
  mapError = false;
  videoUrl = '';
  audioUrl = '';
  mediaError = false;
  book?: { revision: number; snapshot: PublishedNotebook };
  bookSettings?: NotebookSettings;
  bookStatus: 'idle' | 'loading' | 'ready' | 'missing' | 'error' = 'idle';

  ngOnInit() {
    this.navigation = this.route.paramMap.subscribe(params => this.load(params.get('rallyId') ?? '', params.get('pecId') ?? ''));
  }

  private load(rallyId: string, pecId: string) {
    if (!this.sessionIsCurrent()) return;
    this.reset();
    this.rallyId = rallyId;
    this.pecId = pecId;
    this.endpoint = API_BASE_URL + '/api/shared-rallies' + (rallyId ? '/' + encodeURIComponent(rallyId) : '')
      + (pecId ? '/pecs/' + encodeURIComponent(pecId) : '');
    this.loading = true;
    this.error = '';
    if (pecId) {
      this.requests.add(this.http.get<StageView>(this.endpoint).subscribe({
        next: view => { this.stage = view; this.loading = false; this.loadStageResources(view); },
        error: error => this.fail(error),
      }));
    } else if (rallyId) {
      this.requests.add(this.http.get<Rally & { pecs: Stage[] }>(this.endpoint).subscribe({
        next: rally => { this.rally = rally; this.loading = false; },
        error: error => this.fail(error),
      }));
    } else {
      this.requests.add(this.http.get<Rally[]>(this.endpoint).subscribe({
        next: rallies => { this.rallies = rallies; this.loading = false; },
        error: error => this.fail(error),
      }));
    }
  }

  @HostListener('window:storage')
  onStorageChange() { this.sessionIsCurrent(); }

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (document.visibilityState !== 'visible' || !this.sessionIsCurrent() || this.loading || this.error) return;
    if (this.rallyId) this.checkAccess();
    else this.retry();
  }

  checkAccess() {
    if (!this.sessionIsCurrent() || this.checkingAccess || (!this.rally && !this.stage)) return;
    this.checkingAccess = true;
    this.requests.add(this.http.head(this.endpoint).subscribe({
      next: () => { this.checkingAccess = false; },
      error: error => {
        this.reset();
        this.fail(error);
      },
    }));
  }

  private sessionIsCurrent(): boolean {
    if (this.auth.getToken() === this.session) return true;
    this.reset();
    this.loading = false;
    this.sessionChanged = true;
    this.error = 'A sessão mudou. Atualiza esta página antes de continuar.';
    return false;
  }

  private loadStageResources(view: StageView) {
    this.mapNotes = view.notes.filter(note => validCoordinate(note.latitude, note.longitude)).map(note => ({
      id: String(note.id), lat: note.latitude!, lng: note.longitude!, text: note.text, timestamp: note.originalTimestamp,
    }));
    this.requests.add(this.http.get<GpsPoint[]>(this.endpoint + '/gps/track').subscribe({
      next: track => { this.track = track; },
      error: error => { if (!this.clearIfDenied(error)) { this.track = []; this.mapError = true; } },
    }));
    if (view.hasVideo) this.loadMedia('video');
    if (view.hasAudio) this.loadMedia('audio');
  }

  private loadMedia(kind: 'video' | 'audio') {
    this.requests.add(this.http.get(this.endpoint + '/' + kind, { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        if (kind === 'video') this.videoUrl = url;
        else this.audioUrl = url;
      },
      error: error => { if (error.status === 404 || !this.clearIfDenied(error)) this.mediaError = true; },
    }));
  }

  openBook() {
    if (!this.sessionIsCurrent() || !this.stage || this.bookStatus === 'loading') return;
    this.bookStatus = 'loading';
    this.book = undefined;
    this.bookSettings = undefined;
    this.requests.add(this.http.get<{ revision: number; snapshot: PublishedNotebook } | null>(this.endpoint + '/book-publication').subscribe({
      next: book => {
        this.bookStatus = book ? 'ready' : 'missing';
        if (book) {
          this.book = book;
          this.bookSettings = { version: 1, page: book.snapshot.page, rules: [] };
        }
      },
      error: error => { if (!this.clearIfDenied(error)) this.bookStatus = 'error'; },
    }));
  }

  readonly authorizePrint = async (): Promise<boolean> => {
    if (!this.sessionIsCurrent()) return false;
    const endpoint = this.endpoint;
    const book = this.book;
    if (!book) return false;
    try {
      const response = await firstValueFrom(this.http.head(endpoint + '/book-publication', { observe: 'response' }));
      return response.status === 200 && this.sessionIsCurrent() && this.endpoint === endpoint && this.book === book;
    } catch (error) {
      if (this.endpoint === endpoint && this.book === book && error instanceof HttpErrorResponse) this.clearIfDenied(error);
      return false;
    }
  };

  private clearIfDenied(error: HttpErrorResponse): boolean {
    if (![401, 403, 404].includes(error.status)) return false;
    this.reset();
    this.fail(error);
    return true;
  }

  private fail(error: HttpErrorResponse) {
    this.loading = false;
    this.error = [401, 403, 404].includes(error.status)
      ? 'Este conteúdo partilhado não está disponível para a tua conta.'
      : 'Não foi possível carregar os ralis partilhados.';
  }

  retry() { this.load(this.rallyId, this.pecId); }

  private reset() {
    this.requests.unsubscribe();
    this.requests = new Subscription();
    for (const url of [this.audioUrl, this.videoUrl]) if (url) URL.revokeObjectURL(url);
    this.audioUrl = this.videoUrl = '';
    this.stage = this.rally = this.track = this.book = this.bookSettings = undefined;
    this.rallies = [];
    this.mapNotes = [];
    this.checkingAccess = false;
    this.mapError = this.mediaError = false;
    this.bookStatus = 'idle';
  }

  ngOnDestroy() { this.navigation?.unsubscribe(); this.reset(); }
}
