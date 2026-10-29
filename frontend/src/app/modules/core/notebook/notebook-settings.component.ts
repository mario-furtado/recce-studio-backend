import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotebookComponent } from './notebook.component';
import { defaultNotebook, displayRule, positions, settingsError } from './notebook.model';
import { NotebookService } from './notebook.service';
import { CustomNoteDictionaryRule } from '../services/note-dictionary.service';

@Component({
  selector: 'app-notebook-settings', standalone: true, imports: [CommonModule, FormsModule, NotebookComponent],
  templateUrl: './notebook-settings.component.html',
  styleUrl: './notebook-settings.component.css',
  styles: [`:host{display:block;margin-top:24px}:host([hidden]),[hidden]{display:none!important}label{display:flex;flex-direction:column;gap:4px}input,select,textarea{color:var(--text-primary,#eee);background:var(--surface-input,#17202c);border:1px solid #697586;border-radius:6px;padding:6px;max-width:100%}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.rule{padding:12px;border:1px solid #697586;border-radius:8px;margin:8px 0}.check{flex-direction:row;align-items:center}.error{color:#f97373}.dictionary{max-height:420px;overflow:auto}button{margin:8px 8px 8px 0}summary{cursor:pointer;font-weight:bold}`],
})
export class NotebookSettingsComponent implements OnInit, OnChanges {
  @Input() area: 'presentation' | 'notebook' = 'presentation';
  @Input() active = true;
  @Input() dictionaryRules: readonly CustomNoteDictionaryRule[] = [];
  @Input() dictionaryReady = false;
  @Output() configureDictionary = new EventEmitter<void>();
  selectedSymbol = '';
  settings = defaultNotebook();
  sample = 'E6++ nt\nD6 > E3 60 ATT E1 NC';
  readonly positions = positions;
  readonly positionNames = ['Superior esquerdo', 'Superior centro', 'Superior direito', 'Centro esquerdo', 'Centro', 'Centro direito', 'Inferior esquerdo', 'Inferior centro', 'Inferior direito'];
  loaded = false;
  saving = false;
  message = '';
  error = '';
  constructor(private notebook: NotebookService) {}
  get dictionarySymbols() {
    const symbols = new Map<string, CustomNoteDictionaryRule>();
    for (const rule of this.dictionaryRules) {
      const symbol = rule.symbol;
      if (!symbol?.trim() || symbol !== symbol.trim() || symbol.length > 40 || /[\x00-\x1f]/.test(symbol)) continue;
      if (!symbols.has(symbol) || rule.meaning) symbols.set(symbol, rule);
    }
    return Array.from(symbols.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }
  get presentationRules() {
    const symbols = new Set(this.dictionarySymbols.map(rule => rule.symbol));
    return this.settings.rules.filter(rule => symbols.has(rule.match));
  }
  get visiblePresentationRules() { return this.presentationRules.filter(rule => rule.match === this.selectedSymbol); }
  get unlinkedRules() {
    const symbols = new Set(this.dictionarySymbols.map(rule => rule.symbol));
    return this.settings.rules.filter(rule => !symbols.has(rule.match));
  }
  ngOnChanges() { this.syncDefinitions(); }
  private syncDefinitions() {
    if (!this.loaded || !this.dictionaryReady) return;
    const symbols = new Map(this.dictionarySymbols.map(rule => [rule.symbol, rule]));
    // Preserve layout and historical unlinked rules; identity is owned by the dictionary.
    this.settings = { ...this.settings, rules: this.settings.rules.map(rule => {
      const definition = symbols.get(rule.match);
      return definition ? { ...rule, display: definition.symbol, meaning: (definition.meaning || definition.phrase).slice(0, 200) } : rule;
    }) };
  }
  ngOnInit() { this.load(); }
  load() {
    this.error = ''; this.loaded = false;
    this.notebook.load().subscribe({ next: settings => { this.settings = settings; this.loaded = true; this.syncDefinitions(); },
      error: () => { this.error = 'Não foi possível ler o modelo pessoal. Tenta carregar novamente antes de guardar.'; } });
  }
  refresh() { this.settings = { ...this.settings, page: { ...this.settings.page }, rules: [...this.settings.rules] }; this.message = ''; }
  selectSymbol(symbol: string): boolean {
    if (!this.loaded || !this.dictionaryReady || this.saving) return false;
    const definition = this.dictionarySymbols.find(rule => rule.symbol === symbol);
    if (!definition) {
      this.error = 'Define primeiro este símbolo no Dicionário. A apresentação só configura símbolos existentes com até 40 caracteres e sem quebras de linha.';
      return false;
    }
    if (!this.settings.rules.some(rule => rule.match === symbol)) {
      if (this.settings.rules.length >= 250) { this.error = 'O modelo permite até 250 elementos.'; return false; }
      this.settings.rules.push(displayRule(symbol));
      this.refresh();
    }
    this.selectedSymbol = symbol;
    this.syncDefinitions();
    this.sample = symbol;
    this.error = '';
    this.message = '';
    return true;
  }
  reset() {
    if (!this.loaded || !this.dictionaryReady || this.saving) return;
    const defaults = defaultNotebook();
    const symbols = new Set(this.dictionarySymbols.map(rule => rule.symbol));
    this.settings = { ...defaults, rules: this.settings.rules.map(rule => symbols.has(rule.match)
      ? { ...(defaults.rules.find(initial => initial.match === rule.match) ?? displayRule(rule.match)) } : rule) };
    this.syncDefinitions();
    this.message = 'Página e estilos iniciais repostos na pré-visualização. As apresentações antigas sem ligação ao Dicionário foram preservadas. Guarda para confirmar.';
  }
  trackRule(_: number, rule: { match: string }) { return rule.match; }
  save() {
    if (!this.loaded || !this.dictionaryReady || this.saving) return;
    this.syncDefinitions();
    this.error = settingsError(this.settings) ?? '';
    if (this.error) return;
    this.saving = true;
    this.notebook.save(this.settings).subscribe({ next: value => { this.settings = value; this.saving = false; this.message = 'Modelo pessoal guardado.'; },
      error: () => { this.saving = false; this.error = 'Não foi possível guardar. As alterações continuam disponíveis nesta página; tenta novamente.'; } });
  }
}
