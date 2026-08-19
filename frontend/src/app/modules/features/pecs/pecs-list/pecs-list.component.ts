import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { Rally } from '../../../core/models/rally';
import { RallyService } from '../../../core/services/rally.service';
import {
  TeamCar,
  TeamProfileService,
} from '../../../core/services/team-profile.service';
import { ConfirmDialogService } from '../../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { SharedProperties } from '../../../core/shared/shared-properties';

type Surface = 'TERRA' | 'ASFALTO' | 'NEVE' | 'MISTO';

@Component({
  selector: 'app-pecs-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './pecs-list.component.html',
})
export class PecsListComponent implements OnInit, OnDestroy {
  searchTerm = '';
  surfaceFilter = '';
  yearFilter = '';
  carFilter = '';
  classFilter = '';
  statusFilter = 'ACTIVE';
  areFiltersOpen = false;

  isCreatingRally = false;
  editingRallyId: string | null = null;
  selectedLogoFile: File | null = null;
  logoPreviewUrl: string | null = null;

  rallies: Rally[] = [];
  cars: TeamCar[] = [];
  private readonly subscriptions = new Subscription();
  private rallyLogoUrls = new Map<string, string>();

  rallyForm: {
    name: string;
    year: number;
    surface: Surface;
    location: string;
    icon: string;
    carId: string;
    carClass: string;
    status: 'DRAFT' | 'COMPLETED';
  } = this.emptyForm();

  availableIcons: string[] = ['RS', 'R1', 'R2', 'GR', 'PT'];
  surfaceOptions: Surface[] = ['ASFALTO', 'TERRA', 'NEVE', 'MISTO'];
  fallbackClassOptions = ['Rally1', 'Rally2', 'Rally3', 'Rally4', 'Rally5', 'RGT', 'Historico'];

  constructor(
    private router: Router,
    private rallyService: RallyService,
    private teamProfileService: TeamProfileService,
    private confirmDialog: ConfirmDialogService,
    private shared: SharedProperties,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.shared.connectionMode$.subscribe(() =>
        this.syncRemoteDataWithConnectionMode(),
      ),
    );
    this.subscriptions.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => this.syncRemoteDataWithConnectionMode()),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.revokeRallyLogoUrls();
    this.clearLogoSelection();
  }

  loadRalliesFromApi(): void {
    if (!this.isOnlineMode) {
      this.rallies = [];
      return;
    }

    this.rallyService.getRallies().subscribe({
      next: (data: Rally[]) => {
        this.rallies = data;
        this.loadRallyLogos(data);
      },
      error: () => this.shared.error('Erro ao carregar ralis'),
    });
  }

  loadCars(): void {
    if (!this.isOnlineMode) {
      this.cars = [];
      return;
    }

    this.teamProfileService.getCars().subscribe({
      next: (cars) => (this.cars = cars),
      error: () => this.shared.error('Erro ao carregar carros'),
    });
  }

  get filteredRallies(): Rally[] {
    const term = this.searchTerm.toLowerCase().trim();
    return this.rallies.filter((rally) => {
      const matchesSearch =
        !term ||
        rally.name.toLowerCase().includes(term) ||
        rally.location.toLowerCase().includes(term);
      const matchesSurface = !this.surfaceFilter || rally.surface === this.surfaceFilter;
      const matchesYear = !this.yearFilter || String(rally.year) === this.yearFilter;
      const matchesCar = !this.carFilter || rally.carId === this.carFilter;
      const matchesClass = !this.classFilter || rally.carClass === this.classFilter;
      const matchesStatus =
        !this.statusFilter ||
        (this.statusFilter === 'ACTIVE' && rally.status !== 'COMPLETED') ||
        (this.statusFilter === 'COMPLETED' && rally.status === 'COMPLETED');
      return matchesSearch && matchesSurface && matchesYear && matchesCar && matchesClass && matchesStatus;
    });
  }

  get yearOptions(): number[] {
    return [...new Set(this.rallies.map((rally) => rally.year))].sort((a, b) => b - a);
  }

  get registeredClassOptions(): string[] {
    const classes = [
      ...this.cars.map((car) => car.carClass),
      ...this.rallies.map((rally) => rally.carClass || ''),
    ].filter(Boolean);
    return [...new Set(classes)].sort();
  }

  openCreateRallyForm(): void {
    if (!this.ensureOnlineAction()) return;
    this.editingRallyId = null;
    this.resetForm();
    this.clearLogoSelection();
    this.isCreatingRally = true;
  }

  openEditRallyForm(rally: Rally, event: Event): void {
    event.stopPropagation();
    if (!this.ensureOnlineAction()) return;
    this.editingRallyId = rally.id;
    this.rallyForm = {
      name: rally.name,
      year: rally.year,
      surface: rally.surface,
      location: rally.location,
      icon: rally.icon,
      carId: rally.carId || '',
      carClass: rally.carClass || this.getCarClass(rally.carId) || '',
      status: rally.status || 'DRAFT',
    };
    this.clearLogoSelection();
    this.isCreatingRally = true;
  }

  cancelForm(): void {
    this.isCreatingRally = false;
    this.editingRallyId = null;
    this.resetForm();
    this.clearLogoSelection();
  }

  saveRally(): void {
    if (!this.ensureOnlineAction()) return;

    if (!this.rallyForm.name.trim() || !this.rallyForm.location.trim()) {
      this.shared.info('Campos obrigatorios', 'Preenche o nome e a localizacao do rali.');
      return;
    }

    if (this.editingRallyId) {
      this.rallyService.updateRally(this.editingRallyId, this.rallyForm).subscribe({
        next: (updatedRally: Rally) => {
          const index = this.rallies.findIndex((r) => r.id === this.editingRallyId);
          if (index !== -1) this.rallies[index] = updatedRally;
          this.saveLogoIfSelected(updatedRally, 'Rali atualizado');
        },
        error: () => this.shared.error('Erro ao atualizar rali'),
      });
      return;
    }

    this.rallyService.createRally(this.rallyForm).subscribe({
      next: (newRally: Rally) => {
        this.rallies.unshift(newRally);
        this.saveLogoIfSelected(newRally, 'Rali criado');
      },
      error: () => this.shared.error('Erro ao criar rali'),
    });
  }

  async deleteRally(rallyId: string, rallyName: string, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.ensureOnlineAction()) return;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar rali',
      message: `Queres mesmo eliminar "${rallyName}"?`,
      detail: 'Esta ação remove o rali e as PECs associadas no backend.',
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.rallyService.deleteRally(rallyId).subscribe({
      next: () => {
        this.rallies = this.rallies.filter((r) => r.id !== rallyId);
        this.shared.success('Rali eliminado', rallyName);
      },
      error: () => this.shared.error('Erro ao eliminar rali'),
    });
  }

  viewRallyDetails(rallyId: string): void {
    if (!this.ensureOnlineAction()) return;
    this.router.navigate(['/rally', rallyId]);
  }

  resetForm(): void {
    this.rallyForm = this.emptyForm();
  }

  onRallyCarChange(): void {
    const carClass = this.getCarClass(this.rallyForm.carId);
    if (carClass) this.rallyForm.carClass = carClass;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.surfaceFilter = '';
    this.yearFilter = '';
    this.carFilter = '';
    this.classFilter = '';
    this.statusFilter = 'ACTIVE';
  }

  get activeFiltersCount(): number {
    return [
      this.surfaceFilter,
      this.yearFilter,
      this.carFilter,
      this.classFilter,
      this.statusFilter !== 'ACTIVE' ? this.statusFilter : '',
    ].filter(Boolean).length;
  }

  toggleFilters(): void {
    this.areFiltersOpen = !this.areFiltersOpen;
  }

  getCarName(carId?: string): string {
    return this.cars.find((car) => car.id === carId)?.name || '';
  }

  getCarClass(carId?: string): string {
    return this.cars.find((car) => car.id === carId)?.carClass || '';
  }

  getPecsCount(rally: Rally): number {
    return rally.pecsCount ?? rally.pecs?.length ?? 0;
  }

  onRallyLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.selectedLogoFile = file;
    this.logoPreviewUrl = file ? URL.createObjectURL(file) : null;
  }

  getRallyLogoUrl(rally: Rally): string | null {
    return this.rallyLogoUrls.get(rally.id) || null;
  }

  getRallyInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return (words[0] || 'RS').slice(0, 2).toUpperCase();
  }

  private emptyForm() {
    return {
      name: '',
      year: new Date().getFullYear(),
      surface: 'ASFALTO' as Surface,
      location: '',
      icon: 'RS',
      carId: '',
      carClass: '',
      status: 'DRAFT' as const,
    };
  }

  private saveLogoIfSelected(rally: Rally, successTitle: string): void {
    if (!this.selectedLogoFile) {
      this.cancelForm();
      this.shared.success(successTitle, rally.name);
      return;
    }

    this.rallyService.uploadRallyLogo(rally.id, this.selectedLogoFile).subscribe({
      next: (updatedRally) => {
        const index = this.rallies.findIndex((r) => r.id === updatedRally.id);
        if (index !== -1) this.rallies[index] = updatedRally;
        this.loadRallyLogo(updatedRally);
        this.cancelForm();
        this.shared.success(successTitle, updatedRally.name);
      },
      error: () => {
        this.cancelForm();
        this.shared.error('Rali guardado, mas falhou a imagem');
      },
    });
  }

  private clearLogoSelection(): void {
    if (this.logoPreviewUrl) URL.revokeObjectURL(this.logoPreviewUrl);
    this.selectedLogoFile = null;
    this.logoPreviewUrl = null;
  }

  private loadRallyLogos(rallies: Rally[]): void {
    this.revokeRallyLogoUrls();
    rallies
      .filter((rally) => rally.id && rally.logoFileName)
      .forEach((rally) => this.loadRallyLogo(rally));
  }

  private loadRallyLogo(rally: Rally): void {
    if (!rally.id || !rally.logoFileName) {
      return;
    }

    this.rallyService.getRallyLogoBlob(
      rally.id,
      rally.logoStoragePath || rally.logoFileName || Date.now(),
    ).subscribe({
      next: (blob) => {
        this.revokeRallyLogoUrl(rally.id);
        this.rallyLogoUrls.set(rally.id, URL.createObjectURL(blob));
      },
      error: (err) => {
        console.error('Erro ao carregar logo do rali:', err);
        this.revokeRallyLogoUrl(rally.id);
      },
    });
  }

  private revokeRallyLogoUrl(rallyId: string): void {
    const previousUrl = this.rallyLogoUrls.get(rallyId);
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      this.rallyLogoUrls.delete(rallyId);
    }
  }

  private revokeRallyLogoUrls(): void {
    this.rallyLogoUrls.forEach((url) => URL.revokeObjectURL(url));
    this.rallyLogoUrls.clear();
  }

  private get isOnlineMode(): boolean {
    return this.shared.connectionMode$.value === 'online';
  }

  private syncRemoteDataWithConnectionMode(): void {
    if (!this.isOnlineMode) {
      this.rallies = [];
      this.cars = [];
      this.cancelForm();
      return;
    }

    this.loadRalliesFromApi();
    this.loadCars();
  }

  private ensureOnlineAction(): boolean {
    if (this.isOnlineMode) return true;
    this.shared.info(
      'Modo offline ativo',
      'Ralis e PECs do backend ficam disponiveis quando voltares ao modo online.',
    );
    this.router.navigate(['/offline-recces']);
    return false;
  }
}
