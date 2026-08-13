import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PecsEditorComponent } from '../pecs-editor/pecs-editor.component';
import { PecService } from '../../../core/services/pecs.service';
import { RecceModeComponent } from '../../recce-mode/recce-mode.component';
import { SharedProperties } from '../../../core/shared/shared-properties';

export type ViewMode = 'OVERVIEW' | 'RECONNAISSANCE' | 'STUDIO';

@Component({
  selector: 'app-pec-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RecceModeComponent, PecsEditorComponent],
  templateUrl: './pec-detail.component.html',
  styleUrls: ['./pec-detail.component.css'],
})
export class PecDetailComponent implements OnInit {
  pecId: string = '';
  currentMode: ViewMode = 'OVERVIEW';

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
    this.pecId = this.route.snapshot.paramMap.get('id') || '';
    if (this.pecId) {
      this.loadPecData();
    }
  }

  loadPecData(): void {
    this.pecService.getPecById(this.pecId).subscribe({
      next: (data) => {
        this.pec = data;

        // Se a PEC for DRAFT, podes sugerir que comece no OVERVIEW ou RECONNAISSANCE
        if (this.pec.status === 'DRAFT') {
          this.currentMode = 'OVERVIEW';
        }
      },
      error: (err) => console.error('Erro ao carregar detalhes da PEC:', err),
    });
  }

  setMode(mode: ViewMode): void {
    if (this.pec.status === 'COMPLETED' && mode === 'RECONNAISSANCE') {
      return;
    }
    this.currentMode = mode;
  }

  updateStatus(status: 'COMPLETED' | 'DRAFT'): void {
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
