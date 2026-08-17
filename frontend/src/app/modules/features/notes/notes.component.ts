import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  CustomNoteDictionaryRule,
  NoteDictionaryService,
} from '../../core/services/note-dictionary.service';
import { SharedProperties } from '../../core/shared/shared-properties';

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notes.component.html',
})
export class NotesComponent implements OnInit, OnDestroy {
  rules: CustomNoteDictionaryRule[] = [];
  form: CustomNoteDictionaryRule = this.emptyForm();
  editingRuleId: string | null = null;
  isLoading = false;
  isSaving = false;

  private readonly subscriptions = new Subscription();

  constructor(
    public shared: SharedProperties,
    private noteDictionary: NoteDictionaryService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.noteDictionary.rules$.subscribe((rules) => {
        this.rules = rules;
      }),
    );

    if (this.shared.connectionMode$.value === 'online') {
      this.loadRules();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadRules(): void {
    if (this.shared.connectionMode$.value !== 'online') {
      this.shared.info(
        'Notas locais',
        'Sem ligacao, vou usar as regras guardadas neste dispositivo.',
      );
      return;
    }

    this.isLoading = true;
    this.noteDictionary.loadRules().subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.shared.info(
          'Notas locais',
          'Nao consegui ler o backend, mas as regras locais continuam disponiveis.',
        );
      },
    });
  }

  saveRule(): void {
    const payload = this.normalizeForm();
    if (!payload) return;

    const currentRule = this.editingRuleId
      ? this.rules.find((rule) => rule.id === this.editingRuleId)
      : null;

    this.isSaving = true;
    if (this.shared.connectionMode$.value === 'online' && !currentRule?.localOnly) {
      const request = currentRule?.id
        ? this.noteDictionary.updateRule(currentRule.id, payload)
        : this.noteDictionary.createRule(payload);

      request.subscribe({
        next: () => this.finishSave('Regra guardada', 'As notas foram atualizadas.'),
        error: () => {
          this.isSaving = false;
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
    this.finishSave('Regra local guardada', 'Esta regra fica disponivel neste dispositivo.');
  }

  editRule(rule: CustomNoteDictionaryRule): void {
    this.editingRuleId = rule.id || null;
    this.form = {
      id: rule.id,
      phrase: rule.phrase,
      symbol: rule.symbol,
      category: rule.category || '',
      enabled: rule.enabled,
      localOnly: rule.localOnly,
    };
  }

  cancelEdit(): void {
    this.editingRuleId = null;
    this.form = this.emptyForm();
  }

  toggleRule(rule: CustomNoteDictionaryRule): void {
    this.persistRule({ ...rule, enabled: !rule.enabled }, 'Regra atualizada');
  }

  deleteRule(rule: CustomNoteDictionaryRule): void {
    if (!rule.id) return;
    if (!window.confirm(`Eliminar a regra "${rule.phrase}"?`)) return;

    if (this.shared.connectionMode$.value === 'online' && !rule.localOnly) {
      this.noteDictionary.deleteRule(rule.id).subscribe({
        next: () => this.shared.success('Regra eliminada'),
        error: () =>
          this.shared.error(
            'Erro ao eliminar regra',
            'Nao foi possivel eliminar no backend.',
          ),
      });
      return;
    }

    this.noteDictionary.deleteLocalRule(rule.id);
    this.shared.success('Regra eliminada');
  }

  trackRule(_: number, rule: CustomNoteDictionaryRule): string {
    return rule.id || rule.phrase;
  }

  private persistRule(rule: CustomNoteDictionaryRule, successTitle: string): void {
    if (this.shared.connectionMode$.value === 'online' && rule.id && !rule.localOnly) {
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
    const phrase = this.form.phrase.trim();
    const symbol = this.form.symbol.trim();
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
      category: this.form.category?.trim() || '',
      enabled: this.form.enabled !== false,
    };
  }

  private finishSave(title: string, message: string): void {
    this.isSaving = false;
    this.cancelEdit();
    this.shared.success(title, message);
  }

  private emptyForm(): CustomNoteDictionaryRule {
    return {
      phrase: '',
      symbol: '',
      category: '',
      enabled: true,
    };
  }
}
