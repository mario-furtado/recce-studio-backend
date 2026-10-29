import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PecsEditorComponent } from '../pecs-editor/pecs-editor.component';
import { PecService } from '../../../core/services/pecs.service';
import { RecceModeComponent } from '../../recce-mode/recce-mode.component';
import { SharedProperties } from '../../../core/shared/shared-properties';
import { ContextPanelComponent } from '../../../core/shared/components/context-panel.component';

export type ViewMode = 'OVERVIEW' | 'RECONNAISSANCE' | 'STUDIO';

@Component({
  selector: 'app-pec-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RecceModeComponent, PecsEditorComponent, ContextPanelComponent],
  templateUrl: './pec-detail.component.html',
  styleUrls: ['./pec-detail.component.css'],
})
export class PecDetailComponent implements OnInit {
  @ViewChild(RecceModeComponent) recce?: RecceModeComponent;
  @ViewChild(PecsEditorComponent) studio?: PecsEditorComponent;

  canDeactivate(): boolean | Promise<boolean> {
    if (this.recce && !this.recce.canDeactivate()) return false;
    return this.studio?.canDeactivate() ?? true;
  }
  pecId: string = '';
  currentMode: ViewMode = 'OVERVIEW';
  isLoadingPec = true;
  pecUnavailable = false;

  pec: any = {
    id: '',
    number: 0,
    name: 'A carregar...',
    status: 'DRAFT',
    distanceKm: 0,
  };
  isEditingPec = false;
  pecDraft = {
    number: 0,
    name: '',
    distanceKm: 0,
  };

  constructor(
    private route: ActivatedRoute,
    private pecService: PecService,
    private shared: SharedProperties,
  ) {}

  ngOnInit(): void {
    this.pecId = (this.route.snapshot.paramMap.get('id') || '').trim();
    this.loadPecData();
  }

  loadPecData(): void {
    if (!this.pecId) {
      this.isLoadingPec = false;
      this.pecUnavailable = true;
      return;
    }
    this.pecService.getPecById(this.pecId).subscribe({
      next: (data) => {
        this.isLoadingPec = false;
        if (!data || data.id !== this.pecId) { this.pecUnavailable = true; return; }
        this.pec = data;
        this.pecUnavailable = false;

        // Se a PEC for DRAFT, podes sugerir que comece no OVERVIEW ou RECONNAISSANCE
        if (this.pec.status === 'DRAFT') {
          this.setMode('OVERVIEW');
        }
      },
      error: () => {
        this.isLoadingPec = false;
        this.pecUnavailable = true;
        this.shared.error('PEC indisponível', 'Escolhe outra PEC para continuar.');
      },
    });
  }

  setMode(mode: ViewMode): void {
    if (this.isLoadingPec || this.pecUnavailable) return;
    if (mode !== this.currentMode) {
      const allowed = this.canDeactivate();
      if (allowed instanceof Promise) { void allowed.then(ok => { if (ok) { this.studio?.cancelEditNote(); this.studio?.cancelNewNote(); this.setMode(mode); } }); return; }
      if (!allowed) return;
    }
    if (this.pec.status === 'COMPLETED' && mode === 'RECONNAISSANCE') {
      return;
    }
    this.currentMode = mode;
  }

  updateStatus(status: 'COMPLETED' | 'DRAFT'): void {
    if (this.isLoadingPec || this.pecUnavailable || !this.pecId) return;
    const allowed = this.canDeactivate();
    if (allowed instanceof Promise) { void allowed.then(ok => { if (ok) { this.studio?.cancelEditNote(); this.studio?.cancelNewNote(); this.updateStatus(status); } }); return; }
    if (!allowed) return;
    this.pecService.updatePecStatus(this.pecId, status).subscribe({
      next: (updated) => {
        this.pec = { ...this.pec, ...updated, status };
        this.shared.success(
          status === 'COMPLETED' ? 'PEC concluida' : 'PEC voltou a rascunho',
          this.pec.name,
        );
      },
      error: (err) => {
        console.error('Erro ao atualizar estado da PEC:', err);
        this.shared.error('Erro ao atualizar estado da PEC');
      },
    });
  }

  startEditPec(): void {
    if (this.pec.status === 'COMPLETED') return;
    this.pecDraft = {
      number: this.pec.number || 1,
      name: this.pec.name || '',
      distanceKm: this.pec.distanceKm || 0,
    };
    this.isEditingPec = true;
  }

  cancelEditPec(): void {
    this.isEditingPec = false;
  }

  savePecDetails(): void {
    if (this.isLoadingPec || this.pecUnavailable || !this.pecId) return;
    if (!this.pecDraft.name.trim()) {
      this.shared.error('Nome obrigatorio', 'A PEC precisa de um nome.');
      return;
    }

    this.pecService
      .updatePecById(this.pecId, {
        number: this.pecDraft.number,
        name: this.pecDraft.name.trim(),
        distanceKm: Number(this.pecDraft.distanceKm) || 0,
      })
      .subscribe({
        next: (updated) => {
          this.pec = { ...this.pec, ...updated };
          this.isEditingPec = false;
          this.shared.success('PEC atualizada', this.pec.name);
        },
        error: () => this.shared.error('Erro ao atualizar PEC'),
      });
  }

  goBack() {
    window.history.back();
  }
}
