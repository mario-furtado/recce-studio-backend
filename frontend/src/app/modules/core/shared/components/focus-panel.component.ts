import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'dialog[appFocusPanel]', standalone: true, template: '<ng-content />', encapsulation: ViewEncapsulation.None,
  styles: [`dialog[appFocusPanel]{padding:16px;margin:auto;width:min(1120px,calc(100vw - 32px));max-height:90dvh;color:#eef2f7;background:#151c26;border:1px solid #ff718b;border-radius:12px;overflow:auto;box-shadow:0 24px 64px #0009}dialog[appFocusPanel]>header{position:sticky;top:0;z-index:1;background:#151c26;padding-bottom:8px}dialog[appFocusPanel]::backdrop{background:#0009}dialog[appFocusPanel][open]{animation:focus-appear .16s ease-out}@keyframes focus-appear{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){dialog[appFocusPanel][open]{animation:none}}`],
})
export class FocusPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() panelOpen = false;
  @Input() panelTitle = '';
  @Output() panelClosed = new EventEmitter<void>();
  private ready = false;
  private invoker?: HTMLElement;
  constructor(private host: ElementRef<HTMLDialogElement>) {}
  ngAfterViewInit() { this.ready = true; this.apply(); }
  ngOnChanges() { if (this.ready) this.apply(); }
  private apply() {
    const dialog = this.host.nativeElement;
    dialog.setAttribute('aria-label', this.panelTitle);
    if (this.panelOpen && !dialog.open) {
      this.invoker = document.activeElement as HTMLElement;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-panel-heading]')?.focus({ preventScroll: true });
    } else if (!this.panelOpen && dialog.open) this.close(false);
  }
  @HostListener('cancel', ['$event'])
  cancel(event: Event) { event.preventDefault(); this.close(true); }
  @HostListener('keydown', ['$event'])
  key(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !this.host.nativeElement.open) return;
    const controls = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'))
      .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    if (!controls.length) return;
    event.preventDefault();
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  }
  @HostListener('click', ['$event'])
  outside(event: MouseEvent) {
    const dialog = this.host.nativeElement, box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) this.close(true);
  }
  private close(notify: boolean) {
    this.host.nativeElement.close();
    if (notify) this.panelClosed.emit();
    if (this.invoker?.isConnected) this.invoker.focus({ preventScroll: true });
  }
  ngOnDestroy() { this.host.nativeElement.close(); }
}
