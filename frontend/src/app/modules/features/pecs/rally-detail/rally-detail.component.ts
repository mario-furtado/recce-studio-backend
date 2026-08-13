import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RallyDetail, Pec, Rally, NewPec } from '../../../core/models/rally';
import { RallyService } from '../../../core/services/rally.service';
import { PecService } from '../../../core/services/pecs.service';
import {
  TeamCar,
  TeamProfileService,
} from '../../../core/services/team-profile.service';
import { SharedProperties } from '../../../core/shared/shared-properties';

@Component({
  selector: 'app-rally-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './rally-detail.component.html',
})
export class RallyDetailComponent implements OnInit {
  rallyId: string | null = null;
  searchTerm = '';

  rally: RallyDetail = {
    id: '',
    name: '',
    year: new Date().getFullYear(),
    surface: 'TERRA',
    location: '',
    icon: 'RS',
    status: 'DRAFT',
    pecs: [],
  };
  cars: TeamCar[] = [];

  showCreateModal = false;
  editingPecId: string | null = null;
  pecDraft: Pick<Pec, 'number' | 'name' | 'distanceKm'> = {
    number: 1,
    name: '',
    distanceKm: 0,
  };

  newPec: NewPec = {
    number: 1,
    name: '',
    distanceKm: 0,
    status: 'DRAFT',
    totalNotes: 0,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rallyService: RallyService,
    private pecService: PecService,
    private teamProfileService: TeamProfileService,
    private shared: SharedProperties,
  ) {}

  ngOnInit(): void {
    this.rallyId = this.route.snapshot.paramMap.get('id');
    this.loadCars();
    this.getRally();
  }

  loadCars(): void {
    this.teamProfileService.getCars().subscribe({
      next: (cars) => (this.cars = cars),
      error: () => this.shared.error('Erro ao carregar carros'),
    });
  }

  getRally(): void {
    if (!this.rallyId) return;
    this.rallyService.getRallyById(this.rallyId).subscribe({
      next: (data: Rally) => {
        this.rally = {
          ...this.rally,
          id: data.id,
          name: data.name,
          year: data.year,
          surface: data.surface,
          location: data.location,
          icon: data.icon || 'RS',
          logoFileName: data.logoFileName,
          logoUrl: data.logoUrl,
          carId: data.carId,
          carClass: data.carClass,
          pecsCount: data.pecsCount,
          status: data.status || 'DRAFT',
        };
        this.getRallyPecs();
      },
      error: () => this.shared.error('Erro ao carregar rali'),
    });
  }

  getRallyPecs(): void {
    if (!this.rallyId) return;
    this.rallyService.getRallyPecs(this.rallyId).subscribe({
      next: (data: Pec[]) => {
        this.rally.pecs = data;
        this.rally.pecsCount = data.length;
      },
      error: () => this.shared.error('Erro ao carregar PECs'),
    });
  }

  openCreateModal(): void {
    if (this.isCompleted) return;
    const nextNumber = (this.rally.pecs?.length || 0) + 1;
    this.newPec = {
      number: nextNumber,
      name: '',
      distanceKm: 0,
      status: 'DRAFT',
      totalNotes: 0,
    };
    this.showCreateModal = true;
  }

  savePec(): void {
    if (!this.rallyId || !this.newPec.name || this.isCompleted) return;

    this.rallyService.postRallyPec(this.rallyId, this.newPec).subscribe({
      next: (createdPec) => {
        this.rally.pecs.push(createdPec);
        this.rally.pecsCount = this.rally.pecs.length;
        this.showCreateModal = false;
        this.shared.success('PEC criada', createdPec.name);
      },
      error: () => this.shared.error('Erro ao criar PEC'),
    });
  }

  get filteredPecs(): Pec[] {
    if (!this.searchTerm.trim()) return this.rally.pecs;
    const term = this.searchTerm.toLowerCase();
    return this.rally.pecs.filter(
      (pec) =>
        pec.name.toLowerCase().includes(term) ||
        pec.number.toString().includes(term),
    );
  }

  get totalDistance(): number {
    return this.rally.pecs.reduce((acc, pec) => acc + pec.distanceKm, 0);
  }

  get totalNotes(): number {
    return this.rally.pecs.reduce((acc, pec) => acc + pec.totalNotes, 0);
  }

  openPecStudio(pecId: string): void {
    this.router.navigate(['recce/', pecId]);
  }

  deletePec(pecId: string, pecName: string, event: Event): void {
    event.stopPropagation();
    if (this.isCompleted) return;
    if (!confirm(`Tens a certeza que queres eliminar a ${pecName}?`)) return;

    this.pecService.deletePecById(pecId).subscribe({
      next: () => {
        this.rally.pecs = this.rally.pecs.filter((p) => p.id !== pecId);
        this.rally.pecsCount = this.rally.pecs.length;
        this.shared.success('PEC eliminada', pecName);
      },
      error: () => this.shared.error('Erro ao eliminar PEC'),
    });
  }

  startEditPec(pec: Pec, event: Event): void {
    event.stopPropagation();
    if (this.isCompleted || pec.status === 'COMPLETED') return;
    this.editingPecId = pec.id;
    this.pecDraft = {
      number: pec.number,
      name: pec.name,
      distanceKm: pec.distanceKm,
    };
  }

  cancelEditPec(event?: Event): void {
    event?.stopPropagation();
    this.editingPecId = null;
  }

  saveEditedPec(pec: Pec, event: Event): void {
    event.stopPropagation();
    if (this.isCompleted || pec.status === 'COMPLETED') return;
    if (!this.pecDraft.name.trim()) {
      this.shared.error('Nome obrigatorio', 'A PEC precisa de um nome.');
      return;
    }

    this.pecService
      .updatePecById(pec.id, {
        number: this.pecDraft.number,
        name: this.pecDraft.name.trim(),
        distanceKm: Number(this.pecDraft.distanceKm) || 0,
      })
      .subscribe({
        next: (updated) => {
          this.rally.pecs = this.rally.pecs
            .map((item) => (item.id === pec.id ? { ...item, ...updated } : item))
            .sort((a, b) => a.number - b.number);
          this.editingPecId = null;
          this.shared.success('PEC atualizada', updated.name);
        },
        error: () => this.shared.error('Erro ao atualizar PEC'),
      });
  }

  get isCompleted(): boolean {
    return this.rally.status === 'COMPLETED';
  }

  get rallyCarName(): string {
    return this.cars.find((car) => car.id === this.rally.carId)?.name || '';
  }

  get rallyLogoUrl(): string | null {
    return this.rallyService.getRallyLogoUrl(this.rally as Rally);
  }

  get rallyInitials(): string {
    const words = this.rally.name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return (words[0] || 'RS').slice(0, 2).toUpperCase();
  }

  updateRallyStatus(status: 'DRAFT' | 'COMPLETED'): void {
    this.rallyService.updateRally(this.rally.id, { status }).subscribe({
      next: (updated) => {
        this.rally = { ...this.rally, ...updated };
        this.shared.success(
          status === 'COMPLETED' ? 'Rali terminado' : 'Rali voltou a rascunho',
          this.rally.name,
        );
      },
      error: () => this.shared.error('Erro ao atualizar estado do rali'),
    });
  }
}
