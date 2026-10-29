import { AfterContentInit, Component, ElementRef, HostListener, Input, OnDestroy, ViewEncapsulation } from '@angular/core';

let nextPanelId = 0;

/** Native light-dismiss and top layer; placement is bounded by the visual viewport. */
@Component({
  selector: 'details[appContextPanel]', standalone: true, template: '<ng-content />', encapsulation: ViewEncapsulation.None,
  styles: [`
    details[appContextPanel]>[popover]:not(:popover-open){display:none!important}
    details[appContextPanel]>[popover]:popover-open{display:block;color:#eef2f7;background:#1b2431;border:1px solid #ff718b;border-radius:12px;padding:16px;overflow:auto;box-shadow:0 18px 56px #0009;animation:context-appear .14s ease-out}
    details[appContextPanel]>[popover]::backdrop{background:#0005;pointer-events:none}
    details[appContextPanel][open]>summary{outline:2px solid #ff8da0;outline-offset:2px}
    details[appContextPanel]>[popover] button,details[appContextPanel]>[popover] a{position:static;display:block;width:100%;min-height:44px;margin-top:8px}
    details[appContextPanel]>[popover] .action-danger{display:flex;align-items:center;justify-content:center;gap:8px;background:#4c1525;color:#ffe4eb;border-color:#ef708c}
    @keyframes context-appear{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){details[appContextPanel]>[popover]:popover-open{animation:none}}
  `],
})
export class ContextPanelComponent implements AfterContentInit, OnDestroy {
  @Input() panelWidth = 340;
  private trigger!: HTMLElement;
  private panel!: HTMLElement;
  private readonly action = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('button,a[href]')) this.close(false);
  };
  private readonly reposition = () => { if (this.isOpen) this.place(); };
  private readonly sync = () => {
    const open = this.isOpen;
    this.host.nativeElement.open = open;
    this.trigger.setAttribute('aria-expanded', String(open));
  };
  constructor(private host: ElementRef<HTMLDetailsElement>) {}
  get isOpen() { return !!this.panel?.matches(':popover-open'); }
  ngAfterContentInit() {
    const details = this.host.nativeElement;
    this.trigger = details.querySelector<HTMLElement>(':scope > summary')!;
    this.panel = details.querySelector<HTMLElement>(':scope > :not(summary)')!;
    const id = `context-panel-${++nextPanelId}`;
    this.trigger.id ||= `${id}-trigger`; this.panel.id ||= id;
    this.trigger.setAttribute('aria-controls', this.panel.id);
    this.trigger.setAttribute('aria-expanded', 'false');
    this.panel.setAttribute('popover', 'auto');
    this.panel.setAttribute('role', 'region');
    this.panel.tabIndex = -1;
    this.panel.setAttribute('aria-labelledby', this.trigger.id);
    this.panel.addEventListener('toggle', this.sync);
    this.panel.addEventListener('click', this.action, true);
    document.addEventListener('scroll', this.reposition, true);
    window.visualViewport?.addEventListener('resize', this.reposition);
  }
  @HostListener('click', ['$event'])
  click(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.trigger.contains(target)) {
      event.preventDefault();
      if (this.isOpen) this.close(true);
      else {
        this.host.nativeElement.open = true;
        this.panel.showPopover(); this.panel.scrollTop = 0; this.place(); this.sync();
        (this.panel.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]') ?? this.panel).focus({ preventScroll: true });
      }
    }
  }
  @HostListener('change', ['$event'])
  change(event: Event) { if ((event.target as HTMLInputElement).type === 'file') this.close(true); }
  @HostListener('document:keydown', ['$event'])
  key(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.isOpen) { event.preventDefault(); this.close(true); }
  }
  @HostListener('document:focusin', ['$event'])
  focus(event: FocusEvent) {
    const target = event.target as Node;
    if (this.isOpen && !this.panel.contains(target) && !this.trigger.contains(target)) this.close(false);
  }
  @HostListener('window:resize')
  resize() { this.reposition(); }
  close(restoreFocus: boolean) {
    if (this.isOpen) this.panel.hidePopover();
    this.sync();
    if (restoreFocus) this.trigger.focus({ preventScroll: true });
  }
  private place() {
    const anchor = this.trigger.getBoundingClientRect(), viewport = window.visualViewport;
    const left = (viewport?.offsetLeft ?? 0) + 12, top = (viewport?.offsetTop ?? 0) + 12;
    const right = left + (viewport?.width ?? window.innerWidth) - 24;
    const bottom = top + (viewport?.height ?? window.innerHeight) - 24;
    if (anchor.bottom < top || anchor.top > bottom) { this.close(false); return; }
    const style = this.panel.style;
    style.position = 'fixed'; style.inset = 'auto'; style.margin = '0';
    style.boxSizing = 'border-box'; style.width = `${Math.min(this.panelWidth, right - left)}px`;
    style.maxWidth = `${right - left}px`;
    const below = bottom - anchor.bottom - 8, above = anchor.top - top - 8;
    const flip = below < Math.min(240, this.panel.scrollHeight) && above > below;
    style.maxHeight = `${Math.max(0, flip ? above : below)}px`;
    const size = this.panel.getBoundingClientRect();
    style.left = `${Math.max(left, Math.min(anchor.left, right - size.width))}px`;
    style.top = `${Math.max(top, flip ? anchor.top - 8 - size.height : anchor.bottom + 8)}px`;
  }
  ngOnDestroy() {
    this.panel?.removeEventListener('toggle', this.sync);
    this.panel?.removeEventListener('click', this.action, true);
    document.removeEventListener('scroll', this.reposition, true);
    window.visualViewport?.removeEventListener('resize', this.reposition);
    if (this.isOpen) this.panel.hidePopover();
  }
}
