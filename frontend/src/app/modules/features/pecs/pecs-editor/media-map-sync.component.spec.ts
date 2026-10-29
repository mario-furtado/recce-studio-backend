import { ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Pec } from '../../../core/models/rally';
import { PecService } from '../../../core/services/pecs.service';
import { OfflineRecceStoreService } from '../../../core/services/offline-recce-store.service';
import { SharedProperties } from '../../../core/shared/shared-properties';
import { ConfirmDialogService } from '../../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { PecsEditorComponent } from './pecs-editor.component';

describe('FEAT-003 editor media/map synchronization', () => {
  let editor: PecsEditorComponent;
  let api: jasmine.SpyObj<PecService>;
  let shared: jasmine.SpyObj<SharedProperties>;
  let video: HTMLVideoElement;
  beforeEach(() => {
    api = jasmine.createSpyObj('PecService', ['updatePecById', 'saveNote']);
    shared = jasmine.createSpyObj('SharedProperties', ['error', 'success']);
    editor = new PecsEditorComponent({} as ActivatedRoute, api, {} as OfflineRecceStoreService, shared, {} as ConfirmDialogService);
    editor.pecId = 'fixture';
    video = document.createElement('video');
    editor.videoPlayer = new ElementRef(video); editor.videoSrc = 'blob:fixture';
    spyOn(video, 'play').and.resolveTo();
    editor.setNotes([{ id: 'a', originalTimestamp: 1, text: 'D6', latitude: 38, longitude: -9 }]);
  });
  it('applies capture offset to note seeking and clears stale selection on backward seek', () => {
    editor.captureOffset = 2;
    video.currentTime = 3; editor.onTimeUpdate();
    expect(editor.currentTime - editor.captureOffset).toBe(1);
    expect(editor.activeNoteId).toBe('a');
    video.currentTime = 2.1; editor.onTimeUpdate();
    expect(editor.activeNoteId).toBeNull();
    editor.selectMapNote(editor.mapNotes[0]);
    expect(video.currentTime).toBe(3);
    expect(editor.currentTime).toBe(3);
    expect(editor.activeNoteId).toBe('a');
    expect(video.play).toHaveBeenCalled();
  });
  it('uses audio as the timeline when there is no video', () => {
    editor.videoSrc = '';
    const audio = document.createElement('audio'); audio.currentTime = 4;
    editor.audioPlayer = new ElementRef(audio); editor.audioSrc = 'blob:audio';
    editor.onTimeUpdate();
    expect(editor.currentTime).toBe(4);
    expect(editor.activeNoteId).toBe('a');
  });
  it('explains notes outside the media interval without moving playback or falsely selecting them', () => {
    video.currentTime = 0.5;
    editor.captureOffset = -2;
    editor.jumpToNote(editor.notes[0]);
    expect(video.currentTime).toBe(0.5);
    expect(video.play).not.toHaveBeenCalled();
    expect(editor.activeNoteId).toBeNull();
    spyOnProperty(video, 'duration').and.returnValue(2);
    editor.captureOffset = 4;
    editor.jumpToNote(editor.notes[0]);
    expect(video.currentTime).toBe(0.5);
    expect(video.play).not.toHaveBeenCalled();
    expect(shared.error.calls.count()).toBe(2);
  });
  it('anchors the whole recognition, preserving GPS/note time relationships', () => {
    api.updatePecById.and.returnValue(of({ recceVideoOffsetSeconds: 4 } as Pec));
    editor.currentTime = 5;
    editor.setAnchorAtCurrentTime();
    expect(api.updatePecById).toHaveBeenCalledWith('fixture', { recceVideoOffsetSeconds: 4 });
    expect(editor.notes[0].originalTimestamp).toBe(1);
    expect(editor.captureOffset).toBe(4);
  });
  it('persists capture offset without rewriting note times and keeps the old value on failure', () => {
    api.updatePecById.and.returnValue(of({ recceVideoOffsetSeconds: 2.5 } as Pec));
    editor.captureOffsetDraft = 2.5; editor.saveCaptureOffset();
    expect(api.updatePecById).toHaveBeenCalledWith('fixture', { recceVideoOffsetSeconds: 2.5 });
    expect(editor.captureOffset).toBe(2.5);
    expect(editor.notes[0].originalTimestamp).toBe(1);
    api.updatePecById.and.returnValue(throwError(() => new Error('unavailable')));
    editor.captureOffsetDraft = 4; editor.saveCaptureOffset();
    expect(editor.captureOffset).toBe(2.5);
    expect(editor.isSavingOffset).toBeFalse();
    expect(shared.error).toHaveBeenCalled();
  });
  it('rejects empty, non-finite and out-of-range offsets and completed PEC edits', () => {
    for (const invalid of [null, NaN, Infinity, 86401]) {
      editor.captureOffsetDraft = invalid; editor.saveCaptureOffset();
    }
    expect(shared.error.calls.count()).toBe(4);
    editor.pecStatus = 'COMPLETED'; editor.captureOffsetDraft = 2; editor.saveCaptureOffset();
    expect(api.updatePecById).not.toHaveBeenCalled();
  });
  it('creates notes in recognition time and refreshes mapped notes after deletion', () => {
    editor.captureOffset = 2; editor.currentTime = 3;
    editor.newNoteText = 'E3'; editor.newNoteObservation = '';
    api.saveNote.and.returnValue(of({ id: 'b', originalTimestamp: 1, text: 'E3' }));
    editor.saveNewNote();
    expect(api.saveNote.calls.mostRecent().args[1].originalTimestamp).toBe(1);
    editor.removeNoteFromList('a');
    expect(editor.mapNotes.some(note => note.id === 'a')).toBeFalse();
  });
});
