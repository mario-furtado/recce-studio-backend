import { ActivatedRoute } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { PecsEditorComponent } from './pecs-editor.component';
import { Note } from '../../../core/models/rally';
import { PecService } from '../../../core/services/pecs.service';
import { OfflineRecceStoreService } from '../../../core/services/offline-recce-store.service';
import { SharedProperties } from '../../../core/shared/shared-properties';
import { ConfirmDialogService } from '../../../core/shared/components/confirm-dialog/confirm-dialog.service';

describe('FEAT-013 Studio note editing', () => {
  let editor: PecsEditorComponent;
  let api: jasmine.SpyObj<PecService>;
  let shared: jasmine.SpyObj<SharedProperties>;
  const event = () => new Event('click');
  const raw = JSON.stringify({ version: 1, text: 'E3', elements: [{ match: 'E3', occurrence: 0, position: 'top-right', size: 150, bold: true, underline: true, highlight: true }] });
  let note: Note;
  beforeEach(() => {
    api = jasmine.createSpyObj('PecService', ['alignNote', 'updateNote']);
    shared = jasmine.createSpyObj('SharedProperties', ['success', 'error']);
    editor = new PecsEditorComponent({} as ActivatedRoute, api, {} as OfflineRecceStoreService, shared, {} as ConfirmDialogService);
    editor.pecId = 'fixture';
    note = { id: '1', text: 'E3', originalTimestamp: 5, latitude: 40, longitude: -8, presentationJson: raw };
    editor.setNotes([note]);
  });
  it('cancels a draft without persisting or changing the original presentation', () => {
    editor.startEditNote(note, event()); editor.editingNoteText = 'D6'; editor.editingPresentationJson = null;
    editor.cancelEditNote(); expect(editor.notes[0].presentationJson).toBe(raw); expect(editor.notes[0].text).toBe('E3');
    expect(api.alignNote).not.toHaveBeenCalled();
  });
  it('retains a failed draft for retry and round-trips style, coordinates and timestamp on success', () => {
    editor.startEditNote(note, event()); editor.editingNoteTimestamp = 7; editor.editingNoteObservation = 'Atenção local';
    api.alignNote.and.returnValue(throwError(() => new Error('offline')));
    editor.saveEditedNote(note, event());
    expect(editor.editingNoteId).toBe('1'); expect(editor.editingPresentationJson).toBe(raw); expect(editor.isSavingNote).toBeFalse();
    expect(editor.notes[0].originalTimestamp).toBe(5);
    api.alignNote.and.returnValue(of([{ ...note, originalTimestamp: 7, speedRating: 'Atenção local' }]));
    editor.saveEditedNote(note, event());
    expect(api.alignNote.calls.mostRecent().args[2].presentationJson).toBe(raw);
    expect(editor.notes[0].latitude).toBe(40); expect(editor.notes[0].originalTimestamp).toBe(7); expect(editor.notes[0].presentationJson).toBe(raw);
    expect(editor.editingNoteId).toBeNull();
  });
  it('prevents duplicate saves and switching/cancelling drafts while a save is pending', () => {
    const pending = new Subject<Note[]>(); api.alignNote.and.returnValue(pending);
    editor.startEditNote(note, event()); editor.saveEditedNote(note, event()); editor.saveEditedNote(note, event());
    editor.cancelEditNote(); editor.startEditNote({ ...note, id: '2' }, event());
    expect(api.alignNote).toHaveBeenCalledTimes(1); expect(editor.editingNoteId).toBe('1');
    pending.next([note]); pending.complete(); expect(editor.isSavingNote).toBeFalse(); expect(editor.editingNoteId).toBeNull();
  });
  it('sends an explicit reset and rejects invalid time/style or a locked PEC without saving', () => {
    editor.startEditNote(note, event()); editor.editingNoteTimestamp = -1;
    editor.saveEditedNote(note, event()); expect(api.alignNote).not.toHaveBeenCalled();
    editor.editingNoteTimestamp = 5; editor.editingPresentationJson = '{';
    editor.saveEditedNote(note, event()); expect(api.alignNote).not.toHaveBeenCalled();
    editor.editingPresentationJson = null; api.alignNote.and.returnValue(of([{ ...note, presentationJson: null }]));
    editor.saveEditedNote(note, event()); expect(api.alignNote.calls.mostRecent().args[2].presentationJson).toBeNull();
    editor.pecStatus = 'COMPLETED'; editor.startEditNote(note, event()); expect(editor.editingNoteId).toBeNull();
  });
});
