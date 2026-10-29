import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';

/** Modal controls shared by the workflow tours; the target page remains inert. */
@Component({
  selector: 'app-guided-tour', standalone: true, imports: [CommonModule],
  styleUrl: './notes-tour.component.css',
  template: `
    <dialog #dialog class="tour-shell" aria-labelledby="workflow-tour-title" aria-describedby="workflow-tour-description" (cancel)="cancel($event)" (keydown)="trapFocus($event)">
      <div *ngIf="spotlight; else dim" class="tour-spotlight" aria-hidden="true" [style.left.px]="spotlight.left" [style.top.px]="spotlight.top" [style.width.px]="spotlight.width" [style.height.px]="spotlight.height"></div>
      <ng-template #dim><div class="tour-dim" aria-hidden="true"></div></ng-template>
      <section class="tour-panel">
        <p class="tour-progress">{{ name }} · Exemplo temporário · Passo {{ index + 1 }} de {{ total }}</p>
        <h2 id="workflow-tour-title" tabindex="-1">{{ title }}</h2>
        <p id="workflow-tour-description">{{ description }}</p>
        <p *ngIf="!spotlight" class="tour-hint">O elemento pode estar recolhido neste ecrã. Podes continuar ou sair.</p>
        <div class="tour-actions">
          <button type="button" class="soft-button" (click)="previous.emit()" [disabled]="index === 0">Anterior</button>
          <button type="button" class="accent-button" (click)="next.emit()" *ngIf="index < total - 1">Próximo passo</button>
          <button type="button" class="accent-button" (click)="practice.emit()" *ngIf="index === total - 1">{{ practiceLabel }}</button>
          <button type="button" class="soft-button" (click)="exit.emit()">Sair</button>
        </div>
      </section>
    </dialog>`,
})
export class GuidedTourComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() name = '';
  @Input() title = '';
  @Input() description = '';
  @Input() target = '';
  @Input() index = 0;
  @Input() total = 1;
  @Input() practiceLabel = 'Experimentar';
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();
  @Output() exit = new EventEmitter<void>();
  @Output() practice = new EventEmitter<void>();
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  spotlight: { left: number; top: number; width: number; height: number } | null = null;
  private ready = false;
  private frame = 0;
  private advancePending = false;
  private readonly onScroll = () => this.schedule(false);
  constructor(private change: ChangeDetectorRef) {}
  ngAfterViewInit() {
    this.ready = true; this.dialog.nativeElement.showModal();
    document.addEventListener('scroll', this.onScroll, true);
    this.schedule(true);
  }
  ngOnChanges() { this.schedule(true); }
  @HostListener('window:resize') resize() { this.schedule(false); }
  private schedule(advance: boolean) {
    if (!this.ready) return;
    this.advancePending ||= advance;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      if (!this.ready) return;
      const dialog = this.dialog.nativeElement;
      const target = this.target ? document.querySelector<HTMLElement>(this.target) : null;
      if (this.advancePending) {
        this.advancePending = false;
        dialog.querySelector('.tour-panel')?.scrollTo(0, 0);
        dialog.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      const rect = target?.getBoundingClientRect();
      const panel = dialog.querySelector('.tour-panel')!.getBoundingClientRect();
      const left = Math.max(4, (rect?.left ?? 0) - 5), top = Math.max(4, (rect?.top ?? 0) - 5);
      const right = Math.min((rect?.right ?? 0) + 5, innerWidth - 4), bottom = Math.min((rect?.bottom ?? 0) + 5, panel.top - 12);
      this.spotlight = rect?.width && rect.height && right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
      this.change.detectChanges();
    });
  }
  cancel(event: Event) { event.preventDefault(); this.exit.emit(); }
  trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(this.dialog.nativeElement.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement?.id === 'workflow-tour-title')) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  ngOnDestroy() {
    this.ready = false; cancelAnimationFrame(this.frame);
    document.removeEventListener('scroll', this.onScroll, true);
    this.dialog.nativeElement.close();
  }
}
