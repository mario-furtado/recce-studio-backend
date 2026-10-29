import { TestBed } from '@angular/core/testing';
import { defaultNotebook } from './notebook.model';
import { composePresentedNote, presentationElements, presentationError } from './note-presentation';
import { NoteDisplayComponent } from './note-display.component';
import { NotebookComponent } from './notebook.component';

describe('FEAT-013 occurrence presentation', () => {
  const settings = defaultNotebook();
  const text = 'E3 ATT ATT';
  const raw = JSON.stringify({ version: 1, text, elements: [{ match: 'ATT', occurrence: 1, position: 'top-right', size: 150, bold: true, underline: true, highlight: true }] });
  it('styles only the selected repeated occurrence and leaves the model/other notes untouched', () => {
    const before = JSON.stringify(settings);
    const elements = presentationElements(text, settings.rules, raw).filter(item => item.match === 'ATT');
    expect(elements.map(item => item.size)).toEqual([70, 150]);
    expect(elements.map(item => item.position)).toEqual(['bottom-left', 'top-right']);
    expect(presentationElements(text, settings.rules).filter(item => item.match === 'ATT').map(item => item.size)).toEqual([70, 70]);
    expect(JSON.stringify(settings)).toBe(before);
  });
  it('rejects stale, malformed and untrusted style data instead of applying it to changed text', () => {
    for (const invalid of ['{', raw + '{}', raw.replace('150', '151'), raw.replace('top-right', 'url(evil)'), raw.replace('true', '"true"')]) {
      expect(presentationError(text, invalid)).not.toBeNull();
      expect(composePresentedNote(text, settings.rules, invalid)).toEqual(composePresentedNote(text, settings.rules));
    }
    expect(presentationError('D3', raw)).not.toBeNull();
    expect(presentationError(text, null)).toBeNull();
  });
  it('renders the same style in the note and printable notebook, without copying it to another row', () => {
    const display = TestBed.createComponent(NoteDisplayComponent);
    display.componentRef.setInput('text', text); display.componentRef.setInput('rules', settings.rules); display.componentRef.setInput('presentationJson', raw); display.detectChanges();
    const highlighted = display.nativeElement.querySelectorAll('.note-element.note-highlight');
    expect(highlighted.length).toBe(2);
    expect(Array.from(highlighted as NodeListOf<HTMLElement>).some(item => item.style.fontSize === '150%' && item.style.textDecoration === 'underline')).toBeTrue();
    const book = TestBed.createComponent(NotebookComponent);
    book.componentRef.setInput('settings', settings); book.componentRef.setInput('notes', [{ text, presentationJson: raw }, { text }]); book.detectChanges();
    expect(book.componentInstance.error).toBeNull();
    const styled = book.nativeElement.querySelectorAll('.notebook-pages .note-element[style*="150%"]');
    expect(styled.length).toBe(1);
    expect(styled[0].style.textDecoration).toBe('underline');
    book.componentRef.setInput('notes', [{ text, presentationJson: raw.replace('150', '500') }]); book.detectChanges();
    expect(book.componentInstance.error).not.toBeNull();
    expect(book.nativeElement.querySelector('button').disabled).toBeTrue();
  });
});
