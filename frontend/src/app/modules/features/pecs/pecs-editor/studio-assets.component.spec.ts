import { TestBed } from '@angular/core/testing';
import { StudioAssetsComponent } from './studio-assets.component';

describe('FEAT-014 asset control hierarchy', () => {
  function setup() { const fixture = TestBed.createComponent(StudioAssetsComponent); fixture.detectChanges(); return fixture; }
  it('names empty pickers and associates each visible label with its native input', () => {
    const fixture = setup(); const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Descarregar modelo Excel');
    expect(root.querySelectorAll('.asset-status:not(.asset-ready)').length).toBe(4);
    expect(root.querySelector('.asset-delete')).toBeNull();
    for (const label of Array.from(root.querySelectorAll<HTMLLabelElement>('.asset-picker'))) {
      expect(label.control).not.toBeNull(); expect(label.control?.getAttribute('type')).toBe('file');
      expect(label.textContent!.trim()).toBe(label.control!.getAttribute('aria-label')!);
    }
  });
  it('shows the actual file names and differentiates replacement, deletion and Excel export', () => {
    const fixture = setup(); fixture.componentRef.setInput('hasAudio', true); fixture.componentRef.setInput('audioName', 'recce.wav');
    fixture.componentRef.setInput('hasGps', true); fixture.componentRef.setInput('gpsName', 'track.gpx'); fixture.componentRef.setInput('notesCount', 5); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('recce.wav'); expect(root.textContent).toContain('track.gpx');
    expect(root.textContent).toContain('Substituir áudio'); expect(root.textContent).toContain('Eliminar áudio');
    expect(root.textContent).toContain('Substituir GPS'); expect(root.textContent).toContain('5 notas');
    expect(root.textContent).toContain('Exportar notas em Excel'); expect(root.querySelectorAll('.asset-delete').length).toBe(1);
    const removed = spyOn(fixture.componentInstance.removed, 'emit'); root.querySelector<HTMLButtonElement>('.asset-delete')!.click();
    expect(removed).toHaveBeenCalledOnceWith('audio');
  });
  it('keeps management controls disabled in readonly/draft states while allowing a read-only download', () => {
    const fixture = setup(); fixture.componentRef.setInput('locked', true); fixture.componentRef.setInput('hasVideo', true); fixture.componentRef.setInput('blockedReason', 'PEC em modo de leitura.'); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('PEC em modo de leitura.');
    for (const input of Array.from(root.querySelectorAll('input'))) expect(input.disabled).toBeTrue();
    expect(root.querySelector<HTMLButtonElement>('.asset-delete')!.disabled).toBeTrue();
    expect(root.querySelector<HTMLButtonElement>('.asset-download')!.disabled).toBeFalse();
  });
  it('forwards the real file event without duplicating persistence logic and keeps instance IDs unique', () => {
    const first = setup(), second = setup(); expect(first.componentInstance.id).not.toBe(second.componentInstance.id);
    const selected = spyOn(first.componentInstance.selected, 'emit'); const input = first.nativeElement.querySelector('input') as HTMLInputElement;
    const change = new Event('change', { bubbles: true }); input.dispatchEvent(change);
    expect(selected).toHaveBeenCalledOnceWith({ kind: 'video', event: change });
  });
});
