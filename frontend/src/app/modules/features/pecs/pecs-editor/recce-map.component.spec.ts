import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecceMapComponent } from './recce-map.component';

describe('FEAT-003 map rendering', () => {
  let fixture: ComponentFixture<RecceMapComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RecceMapComponent] }).compileComponents();
    fixture = TestBed.createComponent(RecceMapComponent);
  });
  afterEach(() => fixture.destroy());
  it('supports empty data and expansion without inventing a path', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sem coordenadas GPS');
    expect(fixture.componentInstance.vehiclePosition).toBeNull();
    fixture.componentInstance.toggleExpanded(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.expanded')).not.toBeNull();
    fixture.componentInstance.closeExpanded(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.expanded')).toBeNull();
  });
  it('updates position for playback and backward seek, and renders hostile labels only as text', () => {
    fixture.componentRef.setInput('track', [{ lat: 38, lng: -9, timestamp: 0 }, { lat: 38.001, lng: -9, timestamp: 10 }]);
    const note = { id: '1', lat: 38, lng: -9, timestamp: 0, text: '<img src=x onerror=alert(1)> D6 > E3' };
    fixture.componentRef.setInput('notes', [note]);
    fixture.componentRef.setInput('playbackTime', 5);
    fixture.detectChanges();
    expect(fixture.componentInstance.vehiclePosition?.lat).toBeCloseTo(38.0005, 6);
    const label: HTMLButtonElement = fixture.nativeElement.querySelector('.recce-map-note');
    expect(label.textContent).toBe(note.text);
    expect(label.querySelector('img')).toBeNull();
    const selected = spyOn(fixture.componentInstance.noteSelected, 'emit');
    label.click();
    expect(selected).toHaveBeenCalledWith(note);
    fixture.componentRef.setInput('playbackTime', 2); fixture.detectChanges();
    expect(fixture.componentInstance.vehiclePosition?.lat).toBeCloseTo(38.0002, 6);
    fixture.componentRef.setInput('playbackTime', 30); fixture.detectChanges();
    expect(fixture.componentInstance.vehiclePosition).toBeNull();
  });
});
