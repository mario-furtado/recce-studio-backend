import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, Input, OnChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { PecsListComponent } from '../pecs/pecs-list/pecs-list.component';
import { RallyDetailComponent } from '../pecs/rally-detail/rally-detail.component';
import { NoteDisplayComponent } from '../../core/notebook/note-display.component';
import { NotebookComponent } from '../../core/notebook/notebook.component';
import { defaultNotebook } from '../../core/notebook/notebook.model';
import { workflowDemoProviders, WorkflowDemoStore } from './workflow-demo.providers';
import { WorkflowKind } from './workflow-tour.steps';

@Component({
  selector: 'app-workflow-demo', standalone: true,
  imports: [CommonModule, PecsListComponent, RallyDetailComponent, NoteDisplayComponent, NotebookComponent],
  providers: workflowDemoProviders,
  templateUrl: './workflow-demo.component.html',
  styleUrl: './workflow-demo.component.css', encapsulation: ViewEncapsulation.None,
})
export class WorkflowDemoComponent implements OnChanges, AfterViewInit {
  @Input() kind: WorkflowKind = 'rally';
  @Input() index = 0;
  @ViewChild(PecsListComponent) rallies?: PecsListComponent;
  @ViewChild(RallyDetailComponent) pecs?: RallyDetailComponent;
  readonly settings = defaultNotebook();
  readonly sampleNotes = [{ text: 'D6++', time: 12 }, { text: 'E3 60 ATT E1 NC', time: 24 }];
  private ready = false;
  get recording() { return this.index >= 2 && this.index < 4; }
  get videoTime() { return this.index >= 4 ? 24 : this.index >= 2 ? 12 : 0; }
  constructor(public memory: WorkflowDemoStore, private change: ChangeDetectorRef) {}
  ngAfterViewInit() { this.ready = true; this.prepare(); }
  ngOnChanges() { if (this.ready) this.prepare(); }
  private prepare() {
    // Rebuild each displayed state from a clean fixture, so Back never duplicates data.
    this.memory.reset();
    if (this.rallies) {
      this.rallies.rallies = []; this.rallies.cancelForm();
      if (this.index >= 1) {
        this.rallies.openCreateRallyForm();
        this.rallies.rallyForm = { ...this.rallies.rallyForm, name: 'Rali de exemplo', location: 'Serra de exemplo', year: 2026, surface: 'TERRA' };
      }
      if (this.index >= 4) this.rallies.saveRally();
    }
    if (this.pecs) {
      this.pecs.rally.pecs = []; this.pecs.rally.pecsCount = 0; this.pecs.showCreateModal = false;
      if (this.index >= 1) {
        this.pecs.openCreateModal();
        this.pecs.newPec = { ...this.pecs.newPec, number: 1, name: 'Serra de exemplo', distanceKm: 8.5 };
      }
      if (this.index >= 3) this.pecs.savePec();
    }
    this.change.detectChanges();
  }
}
