import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PecsEditorComponent } from './pecs-editor.component';
import { PecDetailComponent } from '../pec-detail/pec-detail.component';
import { PecService } from '../../../core/services/pecs.service';
import { OfflineRecceStoreService } from '../../../core/services/offline-recce-store.service';
import { SharedProperties } from '../../../core/shared/shared-properties';
import { ConfirmDialogService } from '../../../core/shared/components/confirm-dialog/confirm-dialog.service';

describe('FEAT-014 Studio draft navigation', () => {
  let editor: PecsEditorComponent;
  let confirm: jasmine.SpyObj<ConfirmDialogService>;
  const note = { id: '1', text: 'E3', originalTimestamp: 5 };
  beforeEach(() => {
    confirm = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);
    editor = new PecsEditorComponent({} as ActivatedRoute, {} as PecService, {} as OfflineRecceStoreService, {} as SharedProperties, confirm);
    editor.pecId = 'fixture'; editor.setNotes([note]);
  });
  it('distinguishes unchanged, dirty and pending drafts; rejects leaving without clearing content', async () => {
    editor.startEditNote(note, new Event('click')); expect(editor.canDeactivate()).toBeTrue();
    editor.editingNoteText = 'E3 ATT'; confirm.confirm.and.resolveTo(false);
    expect(await editor.canDeactivate()).toBeFalse(); expect(editor.editingNoteText).toBe('E3 ATT');
    editor.backToNotes(); await Promise.resolve(); expect(editor.editingNoteText).toBe('E3 ATT'); expect(editor.editingNoteId).toBe('1');
    confirm.confirm.and.resolveTo(true); expect(await editor.canDeactivate()).toBeTrue();
    editor.isSavingNote = true; expect(editor.canDeactivate()).toBeFalse();
    const unload = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    editor.beforeUnload(unload); expect(unload.defaultPrevented).toBeTrue();
  });
  it('protects switching to another note and creating a new note while edits are dirty', async () => {
    editor.startEditNote(note, new Event('click')); editor.editingNoteText = 'E3 ATT';
    confirm.confirm.and.resolveTo(false); editor.startEditNote({ ...note, id: '2' }, new Event('click'));
    await Promise.resolve(); expect(editor.editingNoteId).toBe('1');
    editor.openAddNoteForm(); await Promise.resolve(); expect(editor.isAddingNote).toBeFalse();
    confirm.confirm.and.resolveTo(true); editor.openAddNoteForm(); await Promise.resolve();
    expect(editor.editingNoteId).toBeNull(); expect(editor.isAddingNote).toBeTrue(); expect(editor.canDeactivate()).toBeTrue();
    editor.newNoteText = 'D6'; expect(editor.hasUnsavedChanges).toBeTrue();
  });
  it('preserves dirty drafts between mobile views without changing playback time or selection', () => {
    editor.startEditNote(note, new Event('click')); editor.currentTime = 12; editor.activeNoteId = '1'; editor.editingNoteText = 'E3 ATT';
    editor.mobileView = 'map'; editor.mobileView = 'video'; editor.mobileView = 'notes';
    expect(editor.currentTime).toBe(12); expect(editor.activeNoteId).toBe('1'); expect(editor.editingNoteText).toBe('E3 ATT');
  });
  it('integrates asynchronous draft confirmation with parent mode and completion actions', async () => {
    const api = jasmine.createSpyObj<PecService>('PecService', ['updatePecStatus']);
    api.updatePecStatus.and.returnValue(of({ id: 'fixture', status: 'COMPLETED' }));
    const parent = new PecDetailComponent({} as ActivatedRoute, api, jasmine.createSpyObj('SharedProperties', ['success']));
    parent.isLoadingPec = false; parent.pecId = 'fixture'; parent.currentMode = 'STUDIO'; parent.studio = editor;
    editor.startEditNote(note, new Event('click')); editor.editingNoteText = 'E3 ATT'; confirm.confirm.and.resolveTo(false);
    parent.setMode('OVERVIEW'); await Promise.resolve(); expect(parent.currentMode).toBe('STUDIO');
    parent.updateStatus('COMPLETED'); await Promise.resolve(); expect(api.updatePecStatus).not.toHaveBeenCalled();
    confirm.confirm.and.resolveTo(true); parent.setMode('OVERVIEW'); await Promise.resolve();
    expect(parent.currentMode).toBe('OVERVIEW'); expect(editor.hasNoteDraft).toBeFalse();
  });
});
