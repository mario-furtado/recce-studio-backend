import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TeamCar,
  TeamProfile,
  TeamProfileService,
  TeamStats,
} from '../../core/services/team-profile.service';
import { ConfirmDialogService } from '../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { SharedProperties } from '../../core/shared/shared-properties';

@Component({
  selector: 'app-team-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team-profile.component.html',
  styleUrl: './team-profile.component.css',
})
export class TeamProfileComponent implements OnInit, OnDestroy {
  isEditing = false;
  isSaving = false;
  logoPreviewUrl: string | null = null;
  private logoVersion = Date.now();
  private failedCarPhotoIds = new Set<string>();
  private carPhotoUrls = new Map<string, string>();

  readonly distanceUnitOptions = ['Quilometros (km)', 'Milhas (mi)'];
  readonly noteSystemOptions = [
    '1-6 (1 Lento, 6 Rapido)',
    '1-6 (1 Rapido, 6 Lento)',
    '1-9 (1 Lento, 9 Rapido)',
    '1-9 (1 Rapido, 9 Lento)',
    'Descritivo',
    'Outro',
  ];
  readonly classOptions = [
    'Rally1',
    'Rally2',
    'Rally3',
    'Rally4',
    'Rally5',
    'RGT',
    'Historico',
    'Outro',
  ];

  team: TeamProfile = this.emptyProfile();
  draft: TeamProfile = this.emptyProfile();
  cars: TeamCar[] = [];
  carDraft: TeamCar = this.emptyCar();
  editingCarId: string | null = null;

  stats: TeamStats = {
    totalPecs: 0,
    totalKm: 0,
    activeEvents: 0,
  };

  selectedNoteSystemOption = this.noteSystemOptions[0];
  customNoteSystem = '';
  selectedClassOption = 'Rally2';
  customClass = '';

  constructor(
    private teamProfileService: TeamProfileService,
    private confirmDialog: ConfirmDialogService,
    private shared: SharedProperties,
  ) {}

  ngOnInit(): void {
    this.loadTeamProfile();
    this.loadCars();
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.revokeLogoUrl();
    this.revokeCarPhotoUrls();
  }

  loadTeamProfile(): void {
    this.teamProfileService.getProfile().subscribe({
      next: (profile) => {
        this.team = profile;
        this.draft = { ...profile };
        this.syncSelectStateFromDraft();
        this.loadLogoImage(profile);
      },
      error: () => this.shared.error('Erro ao carregar perfil da equipa'),
    });
  }

  loadCars(): void {
    this.teamProfileService.getCars().subscribe({
      next: (cars) => {
        this.failedCarPhotoIds.clear();
        this.cars = cars;
        this.loadCarPhotos(cars);
        const selected = cars.find((car) => car.active);
        if (selected) {
          this.team = {
            ...this.team,
            selectedCarId: selected.id,
            car: selected.name,
            carClass: selected.carClass,
          };
          this.draft = { ...this.draft, ...this.team };
        }
      },
      error: () => this.shared.error('Erro ao carregar garagem'),
    });
  }

  loadStats(): void {
    this.teamProfileService.getStats().subscribe({
      next: (stats) => (this.stats = stats),
      error: () => this.shared.error('Erro ao carregar estatisticas'),
    });
  }

  startEdit(): void {
    this.draft = { ...this.team };
    this.syncSelectStateFromDraft();
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.draft = { ...this.team };
    this.carDraft = this.emptyCar();
    this.editingCarId = null;
    this.isEditing = false;
  }

  saveProfile(): void {
    this.applySelectValuesToDraft();
    this.isSaving = true;
    this.teamProfileService.updateProfile(this.draft).subscribe({
      next: (profile) => {
        this.team = profile;
        this.draft = { ...profile };
        this.syncSelectStateFromDraft();
        this.loadLogoImage(profile);
        this.isEditing = false;
        this.isSaving = false;
        this.shared.success('Perfil atualizado', profile.name);
      },
      error: (err) => {
        console.error('Erro ao guardar perfil da equipa:', err);
        this.shared.error('Erro ao guardar perfil da equipa', this.backendMessage(err));
        this.isSaving = false;
      },
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isSaving = true;
    this.teamProfileService.uploadLogo(file).subscribe({
      next: (profile) => {
        this.team = profile;
        this.draft = { ...profile };
        this.syncSelectStateFromDraft();
        this.logoVersion = Date.now();
        this.loadLogoImage(profile);
        this.isSaving = false;
        this.shared.success('Imagem atualizada');
      },
      error: (err) => {
        console.error('Erro ao carregar imagem:', err);
        this.shared.error('Erro ao carregar imagem do perfil', this.backendMessage(err));
        this.isSaving = false;
      },
    });
    input.value = '';
  }

  selectCar(car: TeamCar): void {
    if (!car.id) return;
    this.teamProfileService.selectCar(car.id).subscribe({
      next: (profile) => {
        this.team = profile;
        this.draft = { ...profile };
        this.loadCars();
        this.loadStats();
        this.shared.success('Carro selecionado', profile.car || undefined);
      },
      error: (err) => {
        console.error('Erro ao selecionar carro:', err);
        this.shared.error('Erro ao selecionar carro');
      },
    });
  }

  startEditCar(car: TeamCar): void {
    this.editingCarId = car.id || null;
    this.carDraft = { ...car };
    this.syncClassSelectFromCarDraft();
  }

  newCar(): void {
    this.editingCarId = null;
    this.carDraft = this.emptyCar();
    this.selectedClassOption = 'Rally2';
    this.customClass = '';
  }

  saveCar(): void {
    this.carDraft.carClass = this.selectedClassOption === 'Outro'
      ? this.customClass.trim()
      : this.selectedClassOption;

    if (!this.carDraft.name.trim()) return;

    const request = this.editingCarId
      ? this.teamProfileService.updateCar(this.editingCarId, this.carDraft)
      : this.teamProfileService.createCar(this.carDraft);

    request.subscribe({
      next: () => {
        this.carDraft = this.emptyCar();
        this.editingCarId = null;
        this.loadCars();
        this.shared.success('Carro guardado');
      },
      error: (err) => {
        console.error('Erro ao guardar carro:', err);
        this.shared.error('Erro ao guardar carro');
      },
    });
  }

  async deleteCar(car: TeamCar): Promise<void> {
    if (!car.id) return;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar carro',
      message: `Queres eliminar "${car.name}" da garagem?`,
      detail: car.active
        ? 'Este carro está selecionado. O perfil da equipa ficará sem carro ativo.'
        : 'A foto e os dados deste carro serão removidos da garagem.',
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.teamProfileService.deleteCar(car.id).subscribe({
      next: () => {
        this.loadCars();
        this.loadTeamProfile();
        this.shared.success('Carro eliminado');
      },
      error: (err) => {
        console.error('Erro ao eliminar carro:', err);
        this.shared.error('Erro ao eliminar carro');
      },
    });
  }

  onCarPhotoSelected(car: TeamCar, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!car.id || !file) return;

    this.teamProfileService.uploadCarPhoto(car.id, file).subscribe({
      next: (updatedCar) => {
        this.failedCarPhotoIds.delete(updatedCar.id || car.id || '');
        this.loadCars();
        this.shared.success('Fotografia do carro atualizada');
      },
      error: (err) => {
        console.error('Erro ao carregar fotografia do carro:', err);
        this.shared.error('Erro ao carregar fotografia do carro', this.backendMessage(err));
      },
    });
    input.value = '';
  }

  getCarPhotoUrl(car: TeamCar): string | null {
    if (car.id && this.failedCarPhotoIds.has(car.id)) {
      return null;
    }
    return car.id ? this.carPhotoUrls.get(car.id) || null : null;
  }

  onLogoImageError(): void {
    this.logoPreviewUrl = null;
  }

  onCarPhotoError(car: TeamCar): void {
    if (car.id) {
      this.failedCarPhotoIds.add(car.id);
    }
  }

  private syncSelectStateFromDraft(): void {
    if (this.noteSystemOptions.includes(this.draft.noteSystem)) {
      this.selectedNoteSystemOption = this.draft.noteSystem;
      this.customNoteSystem = '';
    } else {
      this.selectedNoteSystemOption = 'Outro';
      this.customNoteSystem = this.draft.noteSystem || '';
    }
  }

  private syncClassSelectFromCarDraft(): void {
    if (this.classOptions.includes(this.carDraft.carClass)) {
      this.selectedClassOption = this.carDraft.carClass;
      this.customClass = '';
    } else {
      this.selectedClassOption = 'Outro';
      this.customClass = this.carDraft.carClass || '';
    }
  }

  private applySelectValuesToDraft(): void {
    this.draft.noteSystem = this.selectedNoteSystemOption === 'Outro'
      ? this.customNoteSystem.trim()
      : this.selectedNoteSystemOption;
  }

  private backendMessage(err: unknown): string | undefined {
    const error = err as { error?: { message?: string }; message?: string };
    return error.error?.message || error.message;
  }

  private loadLogoImage(profile: TeamProfile): void {
    this.revokeLogoUrl();
    if (!profile.logoUrl) {
      this.logoPreviewUrl = null;
      return;
    }

    this.teamProfileService.getLogoBlob(this.logoVersion).subscribe({
      next: (blob) => {
        this.revokeLogoUrl();
        this.logoPreviewUrl = URL.createObjectURL(blob);
      },
      error: (err) => {
        console.error('Erro ao carregar imagem do perfil:', err);
        this.logoPreviewUrl = null;
      },
    });
  }

  private loadCarPhotos(cars: TeamCar[]): void {
    this.revokeCarPhotoUrls();
    cars
      .filter((car) => car.id && car.photoFileName)
      .forEach((car) => {
        const carId = car.id as string;
        this.teamProfileService.getCarPhotoBlob(
          carId,
          car.photoStoragePath || car.photoFileName || Date.now(),
        ).subscribe({
          next: (blob) => {
            this.revokeCarPhotoUrl(carId);
            this.carPhotoUrls.set(carId, URL.createObjectURL(blob));
          },
          error: (err) => {
            console.error('Erro ao carregar fotografia do carro:', err);
            this.failedCarPhotoIds.add(carId);
          },
        });
      });
  }

  private revokeLogoUrl(): void {
    if (this.logoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.logoPreviewUrl);
    }
    this.logoPreviewUrl = null;
  }

  private revokeCarPhotoUrl(carId: string): void {
    const previousUrl = this.carPhotoUrls.get(carId);
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      this.carPhotoUrls.delete(carId);
    }
  }

  private revokeCarPhotoUrls(): void {
    this.carPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
    this.carPhotoUrls.clear();
  }

  private emptyProfile(): TeamProfile {
    return {
      name: '',
      driverName: '',
      coDriverName: '',
      noteSystem: this.noteSystemOptions[0],
      distanceUnit: this.distanceUnitOptions[0],
    };
  }

  private emptyCar(): TeamCar {
    return {
      name: '',
      carClass: 'Rally2',
      notes: '',
      active: false,
    };
  }
}
