import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ContextPanelComponent } from './context-panel.component';
import { FocusPanelComponent } from './focus-panel.component';

@Component({ standalone: true, imports: [ContextPanelComponent, FocusPanelComponent], template: `
  <details appContextPanel><summary>Primeiro</summary><div><input aria-label="Valor"><button (click)="apply($event)">Aplicar</button></div></details>
  <details appContextPanel [panelWidth]="180"><summary>Segundo</summary><div><button>Outra ação</button></div></details>
  <button id="outside">Fora</button>
  <button id="preview" (click)="preview = true">Pré-visualizar</button>
  <dialog appFocusPanel [panelOpen]="preview" panelTitle="Pré-visualização" (panelClosed)="preview = false"><h2 tabindex="-1" data-panel-heading>Documento</h2><button (click)="preview = false">Fechar</button></dialog>` })
class PanelHost { actions = 0; preview = false; apply(event: Event) { event.stopPropagation(); this.actions++; } }

describe('FEAT-014 contextual panels', () => {
  function setup() {
    const fixture = TestBed.createComponent(PanelHost); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const triggers = Array.from(root.querySelectorAll<HTMLElement>('summary'));
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[popover]'));
    return { fixture, root, triggers, panels };
  }
  it('opens next to the trigger, focuses content and restores focus with Escape', () => {
    const { triggers, panels } = setup(); triggers[0].click();
    expect(panels[0].matches(':popover-open')).toBeTrue();
    expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(panels[0].querySelector('input'));
    const box = panels[0].getBoundingClientRect(), trigger = triggers[0].getBoundingClientRect();
    expect(Math.abs(box.top - trigger.bottom)).toBeLessThan(12);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(panels[0].matches(':popover-open')).toBeFalse(); expect(document.activeElement).toBe(triggers[0]);
  });
  it('keeps only one panel open and closes after an action without losing the input value', () => {
    const { fixture, triggers, panels } = setup(); triggers[0].click();
    const input = panels[0].querySelector('input')!; input.value = 'draft'; input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(panels[0].matches(':popover-open')).toBeTrue();
    panels[0].querySelector('button')!.click(); expect(fixture.componentInstance.actions).toBe(1);
    expect(panels[0].matches(':popover-open')).toBeFalse(); triggers[0].click(); expect(input.value).toBe('draft');
    triggers[1].click(); expect(panels[0].matches(':popover-open')).toBeFalse(); expect(panels[1].matches(':popover-open')).toBeTrue();
  });
  it('closes when keyboard focus leaves and does not steal the new focus', () => {
    const { root, triggers, panels } = setup(); triggers[0].click();
    const outside = root.querySelector<HTMLButtonElement>('#outside')!; outside.focus();
    expect(panels[0].matches(':popover-open')).toBeFalse(); expect(document.activeElement).toBe(outside);
  });
  it('flips above a low trigger and stays inside the viewport', () => {
    const { triggers, panels } = setup();
    const width = window.visualViewport!.width, height = window.visualViewport!.height;
    spyOn(triggers[0], 'getBoundingClientRect').and.returnValue(new DOMRect(width - 60, height - 60, 40, 40));
    panels[0].style.height = '220px'; triggers[0].click();
    const box = panels[0].getBoundingClientRect();
    expect(box.top).toBeLessThan(height - 60); expect(box.left).toBeGreaterThanOrEqual(12);
    expect(box.right).toBeLessThanOrEqual(width - 12); expect(box.bottom).toBeLessThanOrEqual(height - 12);
  });
  it('opens the document modally and restores the invoker when cancelled', () => {
    const { fixture, root } = setup(); const invoker = root.querySelector<HTMLButtonElement>('#preview')!;
    invoker.focus(); invoker.click(); fixture.detectChanges();
    const dialog = root.querySelector('dialog')!; expect(dialog.matches(':modal')).toBeTrue();
    expect(document.activeElement).toBe(dialog.querySelector('h2'));
    const button = dialog.querySelector('button')!; button.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); button.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBeTrue(); expect(document.activeElement).toBe(button);
    const cancel = new Event('cancel', { cancelable: true }); dialog.dispatchEvent(cancel); fixture.detectChanges();
    expect(cancel.defaultPrevented).toBeTrue(); expect(dialog.open).toBeFalse(); expect(fixture.componentInstance.preview).toBeFalse();
    expect(document.activeElement).toBe(invoker);
  });
});
