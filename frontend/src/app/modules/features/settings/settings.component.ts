import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  CustomNoteDictionaryRule,
  NoteDictionaryService,
} from '../../core/services/note-dictionary.service';
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
export class SettingsComponent implements OnInit, OnDestroy {
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
  dictionaryRules: CustomNoteDictionaryRule[] = [];
  dictionaryForm: CustomNoteDictionaryRule = this.emptyDictionaryForm();
  editingRuleId: string | null = null;
  dictionaryLoading = false;
  dictionarySaving = false;

  private readonly subscriptions = new Subscription();

  constructor(
    public shared: SharedProperties,
    private noteDictionary: NoteDictionaryService,
  ) {
    this.selectedShellTheme = this.shared.shellTheme$.value;
    this.selectedAccentTheme = this.shared.accentTheme$.value;
    this.selectedVoiceCaptureMode = this.shared.voiceCaptureMode$.value;
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.noteDictionary.rules$.subscribe((rules) => {
        this.dictionaryRules = rules;
      }),
    );

    if (this.shared.connectionMode$.value === 'online') {
      this.loadDictionaryRules();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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

  loadDictionaryRules(): void {
    if (this.shared.connectionMode$.value !== 'online') {
      this.shared.info(
        'Dicionario local',
        'Sem ligacao, vou usar as regras guardadas neste dispositivo.',
      );
      return;
    }

    this.dictionaryLoading = true;
    this.noteDictionary.loadRules().subscribe({
      next: () => {
        this.dictionaryLoading = false;
      },
      error: () => {
        this.dictionaryLoading = false;
        this.shared.info(
          'Dicionario local',
          'Nao consegui ler o backend, mas as regras locais continuam disponiveis.',
        );
      },
    });
  }

  saveDictionaryRule(): void {
    const payload = this.normalizeForm();
    if (!payload) return;

    const currentRule = this.editingRuleId
      ? this.dictionaryRules.find((rule) => rule.id === this.editingRuleId)
      : null;

    this.dictionarySaving = true;
    if (
      this.shared.connectionMode$.value === 'online' &&
      !currentRule?.localOnly
    ) {
      const request = currentRule?.id
        ? this.noteDictionary.updateRule(currentRule.id, payload)
        : this.noteDictionary.createRule(payload);

      request.subscribe({
        next: () =>
          this.finishDictionarySave(
            'Regra guardada',
            'O dicionario de notas foi atualizado.',
          ),
        error: () => {
          this.dictionarySaving = false;
          this.shared.error(
            'Erro ao guardar regra',
            'Nao foi possivel guardar no backend.',
          );
        },
      });
      return;
    }

    if (currentRule?.id) {
      this.noteDictionary.updateLocalRule({
        ...payload,
        id: currentRule.id,
        localOnly: currentRule.localOnly,
      });
    } else {
      this.noteDictionary.createLocalRule(payload);
    }
    this.finishDictionarySave(
      'Regra local guardada',
      'Esta regra fica disponivel neste dispositivo.',
    );
  }

  editDictionaryRule(rule: CustomNoteDictionaryRule): void {
    this.editingRuleId = rule.id || null;
    this.dictionaryForm = {
      id: rule.id,
      phrase: rule.phrase,
      symbol: rule.symbol,
      category: rule.category || '',
      enabled: rule.enabled,
      localOnly: rule.localOnly,
    };
  }

  cancelDictionaryEdit(): void {
    this.editingRuleId = null;
    this.dictionaryForm = this.emptyDictionaryForm();
  }

  toggleDictionaryRule(rule: CustomNoteDictionaryRule): void {
    this.persistDictionaryRule(
      { ...rule, enabled: !rule.enabled },
      'Regra atualizada',
    );
  }

  deleteDictionaryRule(rule: CustomNoteDictionaryRule): void {
    if (!rule.id) return;
    if (!window.confirm(`Eliminar a regra "${rule.phrase}"?`)) return;

    if (this.shared.connectionMode$.value === 'online' && !rule.localOnly) {
      this.noteDictionary.deleteRule(rule.id).subscribe({
        next: () =>
          this.shared.success(
            'Regra eliminada',
            'A regra foi removida do dicionario.',
          ),
        error: () =>
          this.shared.error(
            'Erro ao eliminar regra',
            'Nao foi possivel eliminar no backend.',
          ),
      });
      return;
    }

    this.noteDictionary.deleteLocalRule(rule.id);
    this.shared.success(
      'Regra eliminada',
      'A regra foi removida deste dispositivo.',
    );
  }

  trackRule(_: number, rule: CustomNoteDictionaryRule): string {
    return rule.id || rule.phrase;
  }

  private persistDictionaryRule(
    rule: CustomNoteDictionaryRule,
    successTitle: string,
  ): void {
    if (
      this.shared.connectionMode$.value === 'online' &&
      rule.id &&
      !rule.localOnly
    ) {
      this.noteDictionary.updateRule(rule.id, rule).subscribe({
        next: () => this.shared.success(successTitle),
        error: () =>
          this.shared.error(
            'Erro ao atualizar regra',
            'Nao foi possivel guardar no backend.',
          ),
      });
      return;
    }

    this.noteDictionary.updateLocalRule(rule);
    this.shared.success(successTitle);
  }

  private normalizeForm(): CustomNoteDictionaryRule | null {
    const phrase = this.dictionaryForm.phrase.trim();
    const symbol = this.dictionaryForm.symbol.trim();
    if (!phrase || !symbol) {
      this.shared.error(
        'Regra incompleta',
        'Preenche o que dizes e o simbolo que deve aparecer.',
      );
      return null;
    }

    return {
      phrase,
      symbol,
      category: this.dictionaryForm.category?.trim() || '',
      enabled: this.dictionaryForm.enabled !== false,
    };
  }

  private finishDictionarySave(title: string, message: string): void {
    this.dictionarySaving = false;
    this.cancelDictionaryEdit();
    this.shared.success(title, message);
  }

  private emptyDictionaryForm(): CustomNoteDictionaryRule {
    return {
      phrase: '',
      symbol: '',
      category: '',
      enabled: true,
    };
  }
}
