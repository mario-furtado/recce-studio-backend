import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppAccentTheme,
  AppShellTheme,
  SharedProperties,
  VoiceCaptureMode,
} from '../../core/shared/shared-properties';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  shellThemes: Array<{
    value: AppShellTheme;
    label: string;
    description: string;
  }> = [
    {
      value: 'dark-blue',
      label: 'RS Original',
      description: 'Tema escuro principal, com contraste alto e identidade motorsport.',
    },
    {
      value: 'dark-blue',
      label: 'Noite',
      description: 'Foco extremo para baixa luz e minima distração.',
    },
    {
      value: 'light',
      label: 'RS Claro',
      description: 'Versao clara para leitura exterior, mantendo contraste controlado.',
    },
    {
      value: 'light',
      label: 'Documento',
      description: 'Máximo contraste para revisão e impressão.',
    },
  ].filter(
    (theme, index, themes) =>
      index ===
      themes.findIndex((candidate) => candidate.value === theme.value),
  ) as Array<{ value: AppShellTheme; label: string; description: string }>;

  accentThemes: Array<{
    value: AppAccentTheme;
    label: string;
    description: string;
  }> = [
    {
      value: 'racing-red',
      label: 'Vermelho',
      description: 'Energia e destaque forte para acoes principais.',
    },
    {
      value: 'midnight-blue',
      label: 'Azul',
      description: 'Mais frio, preciso e discreto.',
    },
    {
      value: 'forest-green',
      label: 'Verde',
      description: 'Mais calmo e orientado a progresso.',
    },
  ];

  voiceCaptureModes: Array<{
    value: VoiceCaptureMode;
    label: string;
    description: string;
  }> = [
    {
      value: 'push-to-talk',
      label: 'Push to talk',
      description: 'Segura o botao da nota para marcar o timestamp e ditar.',
    },
    {
      value: 'always-active',
      label: 'Sempre ativo',
      description: 'A transcricao fica a ouvir durante todo o reconhecimento.',
    },
  ];

  selectedShellTheme: AppShellTheme = 'dark-blue';
  selectedAccentTheme: AppAccentTheme = 'racing-red';
  selectedVoiceCaptureMode: VoiceCaptureMode = 'push-to-talk';

  constructor(
    public shared: SharedProperties,
  ) {
    this.selectedShellTheme = this.shared.shellTheme$.value;
    this.selectedAccentTheme = this.shared.accentTheme$.value;
    this.selectedVoiceCaptureMode = this.shared.voiceCaptureMode$.value;
  }

  setShellTheme(theme: AppShellTheme): void {
    this.selectedShellTheme = theme;
    this.shared.setShellTheme(theme);
  }

  setAccentTheme(theme: AppAccentTheme): void {
    this.selectedAccentTheme = theme;
    this.shared.setAccentTheme(theme);
  }

  setVoiceCaptureMode(mode: VoiceCaptureMode): void {
    this.selectedVoiceCaptureMode = mode;
    this.shared.setVoiceCaptureMode(mode);
  }
}
