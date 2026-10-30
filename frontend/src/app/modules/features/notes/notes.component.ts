import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  CustomNoteDictionaryRule,
  NoteDictionaryService,
} from '../../core/services/note-dictionary.service';
import { ConfirmDialogService } from '../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { SharedProperties } from '../../core/shared/shared-properties';
import { NotebookSettingsComponent } from '../../core/notebook/notebook-settings.component';
import { TeamProfileService } from '../../core/services/team-profile.service';

interface NoteRuleRow {
  id: string;
  phraseLabel: string;
  symbol: string;
  category: string;
  enabled: boolean;
  base: boolean;
  overridden: boolean;
  localOnly: boolean;
  rules: CustomNoteDictionaryRule[];
  primaryRule: CustomNoteDictionaryRule;
}

interface NoteRuleGroup {
  key: string;
  label: string;
  rows: NoteRuleRow[];
  total: number;
  enabled: number;
  custom: number;
}

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, NotebookSettingsComponent, RouterLink],
  styles: ['[hidden]{display:none!important}'],
  styleUrl: './notes.component.css',
  templateUrl: './notes.component.html',
})
export class NotesComponent implements OnInit, OnDestroy {
  @Input() demonstration = false;
  @ViewChild(NotebookSettingsComponent) personalSettings?: NotebookSettingsComponent;
  area: 'dictionary' | 'presentation' | 'notebook' = 'dictionary';
  noteSystem = '';
  systemLoaded = false;
  systemSaving = false;
  systemError = '';
  rules: CustomNoteDictionaryRule[] = [];
  groups: NoteRuleGroup[] = [];
  form: CustomNoteDictionaryRule = this.emptyForm();
  editingRuleId: string | null = null;
  isLoading = false;
  dictionaryLoaded = false;
  isSaving = false;
  searchTerm = '';
  expandedGroups: Record<string, boolean> = {};

  private readonly subscriptions = new Subscription();
  private readonly categoryLabels: Record<string, string> = {
    avisos: 'Avisos',
    corte: 'Corte',
    curvas: 'Curvas',
    distancia: 'Distancia',
    linha: 'Linha',
    ligacao: 'Ligacao',
    piso: 'Piso',
    referencias: 'Referencias',
    ritmo: 'Ritmo',
    travagem: 'Travagem',
  };

  constructor(
    public shared: SharedProperties,
    private noteDictionary: NoteDictionaryService,
    private confirmDialog: ConfirmDialogService,
    private profiles: TeamProfileService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.noteDictionary.rules$.subscribe(() => {
        this.rules = this.noteDictionary.getDisplayRules();
        this.rebuildGroups();
      }),
    );

    if (this.shared.connectionMode$.value === 'online') {
      this.loadRules();
      this.loadNoteSystem();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  canDeactivate(): boolean | Promise<boolean> {
    const cover = this.personalSettings?.reccebook;
    if (cover?.saving) return false;
    if (!cover?.hasUnsavedChanges) return true;
    return this.confirmDialog.confirm({ title: 'Descartar alterações?', message: 'A capa principal tem alterações por guardar.', confirmText: 'Descartar', cancelText: 'Continuar a editar', tone: 'danger' });
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent) {
    const cover = this.personalSettings?.reccebook;
    if (cover?.hasUnsavedChanges || cover?.saving) { event.preventDefault(); event.returnValue = ''; }
  }

  loadNoteSystem(): void {
    this.systemLoaded = false;
    this.systemError = '';
    this.subscriptions.add(this.profiles.getProfile().subscribe({
      next: profile => { this.noteSystem = profile.noteSystem; this.systemLoaded = true; },
      error: () => { this.systemError = 'Não foi possível carregar o sistema base da equipa. Tenta novamente.'; },
    }));
  }

  saveNoteSystem(): void {
    if (!this.systemLoaded || this.systemSaving) return;
    if (!this.noteSystem.trim()) { this.systemError = 'Preenche o sistema de notas base.'; return; }
    this.systemSaving = true;
    this.systemError = '';
    this.subscriptions.add(this.profiles.updateProfile({ noteSystem: this.noteSystem.trim() }).subscribe({
      next: profile => { this.noteSystem = profile.noteSystem; this.systemSaving = false; this.shared.success('Sistema base da equipa guardado'); },
      error: () => { this.systemSaving = false; this.systemError = 'Não foi possível guardar. O texto em edição foi mantido.'; },
    }));
  }

  configureSymbol(row: NoteRuleRow): void {
    if (this.personalSettings?.selectSymbol(row.symbol)) this.area = 'presentation';
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
    this.dictionaryLoaded = false;
    this.noteDictionary.loadRules().subscribe({
      next: () => {
        this.isLoading = false;
        this.dictionaryLoaded = true;
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

    const shouldUseBackend = this.shared.connectionMode$.value === 'online' && !currentRule?.localOnly;
    const canUpdateExisting = !!currentRule?.id && !this.noteDictionary.isBasePlaceholder(currentRule);

    this.isSaving = true;
    if (shouldUseBackend) {
      const request = canUpdateExisting
        ? this.noteDictionary.updateRule(currentRule!.id!, payload)
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

    if (canUpdateExisting) {
      this.noteDictionary.updateLocalRule({
        ...payload,
        id: currentRule!.id,
        localOnly: currentRule!.localOnly,
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
      meaning: rule.meaning || '',
      enabled: rule.enabled,
      localOnly: rule.localOnly,
      base: rule.base,
      overridden: rule.overridden,
      baseSymbol: rule.baseSymbol,
    };
  }

  editRow(row: NoteRuleRow): void {
    this.editRule(row.primaryRule);
  }

  cancelEdit(): void {
    this.editingRuleId = null;
    this.form = this.emptyForm();
  }

  toggleRule(rule: CustomNoteDictionaryRule): void {
    this.persistRule({ ...rule, enabled: !rule.enabled }, 'Regra atualizada');
  }

  toggleRow(row: NoteRuleRow): void {
    const enabled = !row.enabled;
    row.rules.forEach((rule) => {
      this.persistRule({ ...rule, enabled }, 'Regra atualizada');
    });
  }

  async deleteRule(rule: CustomNoteDictionaryRule): Promise<void> {
    if (!rule.id) return;
    const isBaseRule = this.noteDictionary.isBaseRule(rule);
    const isRestore = isBaseRule && rule.overridden;
    const confirmed = await this.confirmDialog.confirm({
      title: isRestore ? 'Repor nota base' : 'Eliminar regra',
      message: isRestore
        ? `Queres repor "${rule.phrase}" para o valor base da app?`
        : `Queres eliminar a regra "${rule.phrase}"?`,
      detail: isRestore
        ? `A nota volta a escrever "${rule.baseSymbol}".`
        : 'A conversão personalizada deixa de ser aplicada às próximas notas.',
      confirmText: isRestore ? 'Repor' : 'Eliminar',
      tone: isRestore ? 'default' : 'danger',
    });
    if (!confirmed) return;

    if (this.noteDictionary.isBasePlaceholder(rule)) {
      return;
    }

    if (this.shared.connectionMode$.value === 'online' && !rule.localOnly) {
      this.noteDictionary.deleteRule(rule.id).subscribe({
        next: () => this.shared.success(isRestore ? 'Nota reposta' : 'Regra eliminada'),
        error: () =>
          this.shared.error(
            'Erro ao eliminar regra',
            'Nao foi possivel eliminar no backend.',
          ),
      });
      return;
    }

    this.noteDictionary.deleteLocalRule(rule.id);
    this.shared.success(isRestore ? 'Nota reposta' : 'Regra eliminada');
  }

  deleteLabel(rule: CustomNoteDictionaryRule): string {
    return this.noteDictionary.isBaseRule(rule) && rule.overridden ? 'Repor' : 'Eliminar';
  }

  rowDeleteLabel(row: NoteRuleRow): string {
    return this.deleteLabel(row.primaryRule);
  }

  canDelete(rule: CustomNoteDictionaryRule): boolean {
    return !this.noteDictionary.isBaseRule(rule) || !!rule.overridden;
  }

  canDeleteRow(row: NoteRuleRow): boolean {
    return this.canDelete(row.primaryRule);
  }

  trackRule(_: number, rule: CustomNoteDictionaryRule): string {
    return rule.id || rule.phrase;
  }

  trackGroup(_: number, group: NoteRuleGroup): string {
    return group.key;
  }

  trackRow(_: number, row: NoteRuleRow): string {
    return row.id;
  }

  toggleGroup(group: NoteRuleGroup): void {
    this.expandedGroups[group.key] = !this.isGroupExpanded(group);
  }

  isGroupExpanded(group: NoteRuleGroup): boolean {
    return this.expandedGroups[group.key] !== false;
  }

  onSearchChange(): void {
    this.rebuildGroups();
  }

  private persistRule(rule: CustomNoteDictionaryRule, successTitle: string): void {
    const canUpdateExisting = !!rule.id && !this.noteDictionary.isBasePlaceholder(rule);

    if (this.shared.connectionMode$.value === 'online' && !rule.localOnly) {
      const request = canUpdateExisting
        ? this.noteDictionary.updateRule(rule.id!, rule)
        : this.noteDictionary.createRule(rule);

      request.subscribe({
        next: () => this.shared.success(successTitle),
        error: () =>
          this.shared.error(
            'Erro ao atualizar regra',
            'Nao foi possivel guardar no backend.',
          ),
      });
      return;
    }

    if (canUpdateExisting) {
      this.noteDictionary.updateLocalRule(rule);
    } else {
      this.noteDictionary.createLocalRule(rule);
    }
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
      meaning: this.form.meaning?.trim() || '',
      enabled: this.form.enabled !== false,
    };
  }

  private rebuildGroups(): void {
    const query = this.normalizeSearch(this.searchTerm);
    const rows = this.buildRows(this.rules)
      .filter((row) => {
        if (!query) return true;
        return this.normalizeSearch(`${row.phraseLabel} ${row.primaryRule.meaning || ''} ${row.symbol} ${row.category}`).includes(query);
      });

    const groupsByCategory = new Map<string, NoteRuleRow[]>();
    rows.forEach((row) => {
      const key = row.category || 'outros';
      groupsByCategory.set(key, [...(groupsByCategory.get(key) || []), row]);
    });

    this.groups = Array.from(groupsByCategory.entries())
      .map(([key, groupRows]) => ({
        key,
        label: this.categoryLabels[key] || this.titleCase(key),
        rows: groupRows.sort((a, b) => a.phraseLabel.localeCompare(b.phraseLabel)),
        total: groupRows.length,
        enabled: groupRows.filter((row) => row.enabled).length,
        custom: groupRows.filter((row) => row.overridden || row.localOnly || !row.base).length,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    this.groups.forEach((group) => {
      if (this.expandedGroups[group.key] === undefined) {
        this.expandedGroups[group.key] = group.custom > 0 || group.key === 'curvas';
      }
    });
  }

  private buildRows(rules: CustomNoteDictionaryRule[]): NoteRuleRow[] {
    const rowsByKey = new Map<string, CustomNoteDictionaryRule[]>();
    rules.forEach((rule) => {
      const key = [
        rule.category || 'outros',
        rule.symbol,
        rule.meaning || '',
        this.canonicalPhrase(rule.phrase),
        rule.localOnly ? 'local' : 'shared',
        rule.overridden ? 'custom' : 'base',
      ].join('|');
      rowsByKey.set(key, [...(rowsByKey.get(key) || []), rule]);
    });

    return Array.from(rowsByKey.entries()).map(([key, rowRules]) => {
      const primaryRule = this.primaryRule(rowRules);
      const phrases = rowRules
        .map((rule) => rule.phrase)
        .sort((a, b) => this.phraseSortWeight(a) - this.phraseSortWeight(b) || a.localeCompare(b));
      return {
        id: key,
        phraseLabel: phrases.join(' / '),
        symbol: primaryRule.symbol,
        category: primaryRule.category || 'outros',
        enabled: rowRules.some((rule) => rule.enabled),
        base: rowRules.every((rule) => !!rule.base),
        overridden: rowRules.some((rule) => !!rule.overridden),
        localOnly: rowRules.some((rule) => !!rule.localOnly),
        rules: rowRules,
        primaryRule,
      };
    });
  }

  private primaryRule(rules: CustomNoteDictionaryRule[]): CustomNoteDictionaryRule {
    return [...rules].sort((a, b) => this.phraseSortWeight(a.phrase) - this.phraseSortWeight(b.phrase))[0];
  }

  private phraseSortWeight(phrase: string): number {
    return /\d/.test(phrase) ? 0 : 1;
  }

  private canonicalPhrase(phrase: string): string {
    return this.normalizeSearch(phrase)
      .split(' ')
      .map((token) => this.numberWordToDigit(token) || token)
      .join(' ');
  }

  private normalizeSearch(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private numberWordToDigit(token: string): string | null {
    const numbers: Record<string, string> = {
      um: '1',
      uma: '1',
      dois: '2',
      duas: '2',
      tres: '3',
      quatro: '4',
      cinco: '5',
      seis: '6',
      sete: '7',
      oito: '8',
      nove: '9',
    };
    return numbers[token] || null;
  }

  private titleCase(value: string): string {
    return value
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
