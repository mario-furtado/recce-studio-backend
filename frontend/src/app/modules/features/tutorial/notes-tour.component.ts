import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotesComponent } from '../notes/notes.component';
import { NotebookComponent } from '../../core/notebook/notebook.component';
import { defaultNotebook } from '../../core/notebook/notebook.model';
import { SharedProperties } from '../../core/shared/shared-properties';
import { DemoDictionary, notesDemoProviders } from './notes-demo.providers';
import { notesTourSteps, tourParts } from './notes-tour.steps';

@Component({
  selector: 'app-notes-tour', standalone: true,
  imports: [CommonModule, NotesComponent, NotebookComponent],
  providers: notesDemoProviders,
  templateUrl: './notes-tour.component.html',
  styleUrl: './notes-tour.component.css',
})
export class NotesTourComponent implements AfterViewInit, OnDestroy {
  @ViewChild('tourDialog') dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild(NotesComponent) notes?: NotesComponent;
  readonly steps = notesTourSteps;
  index: number;
  readonly firstIndex: number;
  readonly lastIndex: number;
  spotlight: { left: number; top: number; width: number; height: number } | null = null;
  readonly studioNotes = [{ text: 'E6++ nt' }, { text: 'D6 > E3 60 ATT E1 NC' }];
  studioSettings = defaultNotebook();
  private frame = 0;
  private readonly onScroll = () => this.reposition();
  private readonly previousFocus = document.activeElement as HTMLElement | null;
  get step() { return this.steps[this.index]; }

  constructor(route: ActivatedRoute, private router: Router, private cdr: ChangeDetectorRef,
    private dictionary: DemoDictionary, public shared: SharedProperties) {
    const introductory = route.snapshot.routeConfig?.path === 'tutorial/notes';
    const part = introductory ? '' : route.snapshot.queryParamMap.get('part') || '';
    this.index = introductory ? 0 : (tourParts.get(part) ?? 1);
    this.firstIndex = tourParts.get(part) ?? 0;
    this.lastIndex = new Map([['dictionary', 4], ['presentation', 7], ['notebook', 9], ['studio', 11]]).get(part) ?? 11;
  }

  ngAfterViewInit() {
    if (this.shared.connectionMode$.value === 'offline') {
      void this.router.navigateByUrl('/tutorial');
      return;
    }
    this.dialog.nativeElement.showModal();
    document.addEventListener('scroll', this.onScroll, true);
    this.applyStep();
  }

  next() {
    if (this.index === 0) {
      void this.router.navigate(['/notes/learn']);
    } else if (this.index < this.lastIndex) {
      this.index++;
      this.applyStep();
    }
  }

  previous() {
    if (this.index === 1) void this.router.navigate(['/tutorial/notes']);
    else if (this.index > this.firstIndex) { this.index--; this.applyStep(); }
  }

  exit(practice = false) {
    this.dialog.nativeElement.close();
    void this.router.navigateByUrl(practice ? '/notes' : '/tutorial').then(navigated => {
      if (!navigated) return;
      const heading = document.querySelector<HTMLElement>('main h1');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  }

  cancel(event: Event) { event.preventDefault(); this.exit(); }

  trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(this.dialog.nativeElement.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first = buttons[0], last = buttons[buttons.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active?.id === 'tour-title')) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault(); first?.focus();
    }
  }

  private applyStep() {
    if (this.notes) {
      this.notes.area = this.step.area === 'studio' ? 'notebook' : this.step.area;
      if (this.index === 3) this.notes.form = {
        phrase: 'esquerda exemplo', symbol: 'E6', meaning: 'Curva de exemplo — define o teu significado', category: 'curvas', enabled: true,
      };
      if (this.index >= 4 && !this.dictionary.rules$.value.length) {
        this.dictionary.createRule({ phrase: 'esquerda exemplo', symbol: 'E6', meaning: 'Curva de exemplo — define o teu significado', category: 'curvas', enabled: true });
        this.notes.cancelEdit();
      }
      if (this.index >= 5) {
        for (const symbol of ['++', 'nt']) {
          if (!this.dictionary.rules$.value.some(rule => rule.symbol === symbol)) {
            this.dictionary.createRule({ phrase: `${symbol} de exemplo`, symbol, meaning: 'Modificador de exemplo — definido no Dicionário', category: 'exemplo', enabled: true });
          }
        }
        this.cdr.detectChanges();
      }
      const personal = this.notes.personalSettings;
      if (personal && this.index >= 5) {
        personal.settings = defaultNotebook();
        personal.selectSymbol(this.index === 6 ? '++' : 'E6');
        personal.sample = 'E6++ nt\nD6 > E3 60 ATT E1 NC';
        personal.settings.page = { ...personal.settings.page, format: 'A5', orientation: 'portrait', rowsPerPage: 6, fontPt: 18 };
        // Exercise the real overflow detector, rather than showing a fabricated warning.
        if (this.index === 9) personal.sample = 'W'.repeat(200);
        personal.refresh();
        this.studioSettings = structuredClone(personal.settings);
      }
    }
    this.cdr.detectChanges();
    const heading = this.dialog.nativeElement.querySelector<HTMLElement>('h2');
    this.dialog.nativeElement.querySelector('.tour-panel')?.scrollTo(0, 0);
    heading?.focus({ preventScroll: true });
    const target = document.querySelector<HTMLElement>(this.step.target);
    if (this.index > 0) target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    this.reposition();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  reposition() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(this.step.target);
      const rect = target?.getBoundingClientRect();
      const panel = this.dialog.nativeElement.querySelector('.tour-panel')?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) this.spotlight = null;
      else {
        const left = Math.max(4, rect.left - 5), top = Math.max(4, rect.top - 5);
        const bottom = Math.min(rect.bottom + 5, (panel?.top ?? window.innerHeight) - 12);
        this.spotlight = bottom > top ? { left, top, width: Math.min(rect.right + 5, window.innerWidth - 4) - left, height: bottom - top } : null;
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.frame);
    document.removeEventListener('scroll', this.onScroll, true);
    this.dialog.nativeElement.close();
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
  }
}
