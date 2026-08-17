import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface CustomNoteDictionaryRule {
  id?: string;
  phrase: string;
  symbol: string;
  category?: string;
  enabled: boolean;
  localOnly?: boolean;
  base?: boolean;
  overridden?: boolean;
  baseSymbol?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NoteDictionaryService {
  private readonly apiUrl = `${API_BASE_URL}/api/note-dictionary-rules`;
  private readonly cacheKey = 'recce_note_dictionary_rules';
  private readonly baseRules = this.buildBaseRules();

  readonly rules$ = new BehaviorSubject<CustomNoteDictionaryRule[]>(this.loadLocalRules());

  constructor(private http: HttpClient) {}

  getRules(): CustomNoteDictionaryRule[] {
    return this.rules$.value;
  }

  getActiveRules(): CustomNoteDictionaryRule[] {
    return this.rules$.value.filter((rule) => rule.enabled && !!rule.phrase?.trim() && !!rule.symbol?.trim());
  }

  getDisplayRules(): CustomNoteDictionaryRule[] {
    const overridesByPhrase = new Map(
      this.rules$.value.map((rule) => [this.phraseKey(rule.phrase), rule]),
    );

    const baseRows = this.baseRules.map((baseRule) => {
      const override = overridesByPhrase.get(this.phraseKey(baseRule.phrase));
      if (!override) return baseRule;
      return {
        ...override,
        base: true,
        overridden: true,
        baseSymbol: baseRule.symbol,
      };
    });

    const customRows = this.rules$.value.filter(
      (rule) => !this.baseRules.some((baseRule) => this.phraseKey(baseRule.phrase) === this.phraseKey(rule.phrase)),
    );

    return [...baseRows, ...customRows].sort((a, b) =>
      `${a.category || ''}${a.phrase}`.localeCompare(`${b.category || ''}${b.phrase}`),
    );
  }

  isBaseRule(rule: CustomNoteDictionaryRule): boolean {
    return !!rule.base || this.baseRules.some((baseRule) => this.phraseKey(baseRule.phrase) === this.phraseKey(rule.phrase));
  }

  isBasePlaceholder(rule: CustomNoteDictionaryRule): boolean {
    return !!rule.id?.startsWith('base:');
  }

  restoreBaseRule(rule: CustomNoteDictionaryRule): void {
    if (!rule.id || this.isBasePlaceholder(rule)) return;
    this.removeRule(rule.id);
  }

  loadRules(): Observable<CustomNoteDictionaryRule[]> {
    return this.http.get<CustomNoteDictionaryRule[]>(this.apiUrl).pipe(
      tap((rules) => {
        const localOnlyRules = this.rules$.value.filter((rule) => rule.localOnly);
        this.setRules([...rules, ...localOnlyRules]);
      }),
    );
  }

  createRule(rule: CustomNoteDictionaryRule): Observable<CustomNoteDictionaryRule> {
    return this.http.post<CustomNoteDictionaryRule>(this.apiUrl, this.cleanRule(rule)).pipe(
      tap((saved) => this.upsertRule(saved)),
    );
  }

  updateRule(ruleId: string, rule: CustomNoteDictionaryRule): Observable<CustomNoteDictionaryRule> {
    return this.http.patch<CustomNoteDictionaryRule>(`${this.apiUrl}/${ruleId}`, this.cleanRule(rule)).pipe(
      tap((saved) => this.upsertRule(saved)),
    );
  }

  deleteRule(ruleId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${ruleId}`).pipe(
      tap(() => this.removeRule(ruleId)),
    );
  }

  createLocalRule(rule: CustomNoteDictionaryRule): void {
    this.upsertRule({
      ...this.cleanRule(rule),
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      localOnly: true,
    });
  }

  updateLocalRule(rule: CustomNoteDictionaryRule): void {
    this.upsertRule({
      ...this.cleanRule(rule),
      id: rule.id,
      localOnly: rule.localOnly,
    });
  }

  deleteLocalRule(ruleId: string): void {
    this.removeRule(ruleId);
  }

  private setRules(rules: CustomNoteDictionaryRule[]): void {
    const normalized = rules.map((rule) => this.normalizeRule(rule));
    this.rules$.next(normalized);
    this.persist(normalized);
  }

  private upsertRule(rule: CustomNoteDictionaryRule): void {
    const normalized = this.normalizeRule(rule);
    const rules = this.rules$.value.filter((current) => current.id !== normalized.id);
    const next = [...rules, normalized].sort((a, b) => a.phrase.localeCompare(b.phrase));
    this.rules$.next(next);
    this.persist(next);
  }

  private removeRule(ruleId: string): void {
    const next = this.rules$.value.filter((rule) => rule.id !== ruleId);
    this.rules$.next(next);
    this.persist(next);
  }

  private cleanRule(rule: CustomNoteDictionaryRule): CustomNoteDictionaryRule {
    return {
      id: rule.id,
      phrase: (rule.phrase || '').trim(),
      symbol: (rule.symbol || '').trim(),
      category: (rule.category || '').trim(),
      enabled: rule.enabled !== false,
      localOnly: rule.localOnly,
    };
  }

  private normalizeRule(rule: CustomNoteDictionaryRule): CustomNoteDictionaryRule {
    return {
      ...this.cleanRule(rule),
      enabled: rule.enabled !== false,
      base: rule.base,
      overridden: rule.overridden,
      baseSymbol: rule.baseSymbol,
    };
  }

  private buildBaseRules(): CustomNoteDictionaryRule[] {
    const fixedRules: Array<Pick<CustomNoteDictionaryRule, 'phrase' | 'symbol' | 'category'>> = [
      { phrase: 'atencao', symbol: 'ATT', category: 'avisos' },
      { phrase: 'perigo', symbol: '!', category: 'avisos' },
      { phrase: 'nao corta', symbol: 'NC', category: 'corte' },
      { phrase: 'corta', symbol: 'C', category: 'corte' },
      { phrase: 'corta muito', symbol: 'C+', category: 'corte' },
      { phrase: 'corta pouco', symbol: 'C-', category: 'corte' },
      { phrase: 'travagem', symbol: 'TR', category: 'travagem' },
      { phrase: 'trava', symbol: 'TR', category: 'travagem' },
      { phrase: 'travagem forte', symbol: 'TR+', category: 'travagem' },
      { phrase: 'lomba', symbol: 'LB', category: 'piso' },
      { phrase: 'salto', symbol: 'SL', category: 'piso' },
      { phrase: 'ponte', symbol: 'PT', category: 'referencias' },
      { phrase: 'cruzamento', symbol: 'CRZ', category: 'referencias' },
      { phrase: 'chicane', symbol: 'CHICANE', category: 'referencias' },
      { phrase: 'gancho', symbol: 'G', category: 'curvas' },
      { phrase: 'alcatrao', symbol: 'ALC', category: 'piso' },
      { phrase: 'asfalto', symbol: 'ALC', category: 'piso' },
      { phrase: 'terra', symbol: 'TERRA', category: 'piso' },
      { phrase: 'gravilha', symbol: 'GRAVILHA', category: 'piso' },
      { phrase: 'mudanca de piso', symbol: 'MUD. PISO', category: 'piso' },
      { phrase: 'centro', symbol: 'CNT', category: 'linha' },
      { phrase: 'tardia', symbol: 'td', category: 'linha' },
      { phrase: 'estreita', symbol: 'estreita', category: 'linha' },
      { phrase: 'cega', symbol: 'cega', category: 'linha' },
      { phrase: 'esconde', symbol: 'esconde', category: 'linha' },
      { phrase: 'longa', symbol: 'L', category: 'distancia' },
      { phrase: 'longo', symbol: 'L', category: 'distancia' },
      { phrase: 'muito longa', symbol: 'LL', category: 'distancia' },
      { phrase: 'muito longo', symbol: 'LL', category: 'distancia' },
      { phrase: 'curta', symbol: 'ct', category: 'distancia' },
      { phrase: 'curto', symbol: 'ct', category: 'distancia' },
      { phrase: 'fecha', symbol: 'f', category: 'linha' },
      { phrase: 'aperta', symbol: 'ap', category: 'linha' },
      { phrase: 'fecha muito', symbol: 'f+', category: 'linha' },
      { phrase: 'abre', symbol: 'ab', category: 'linha' },
      { phrase: 'a fundo', symbol: 'AF', category: 'ritmo' },
      { phrase: 'fundo', symbol: 'AF', category: 'ritmo' },
      { phrase: 'imediatamente', symbol: '>>', category: 'ligacao' },
      { phrase: 'logo', symbol: '>>', category: 'ligacao' },
      { phrase: 'para imediatamente', symbol: '>>', category: 'ligacao' },
      { phrase: 'sobre', symbol: 's/', category: 'ligacao' },
      { phrase: 'entrada', symbol: 'ent', category: 'referencias' },
      { phrase: 'meta', symbol: 'META', category: 'referencias' },
      { phrase: 'agua', symbol: 'AGUA', category: 'piso' },
      { phrase: 'mantem', symbol: 'm', category: 'ritmo' },
    ];

    const numberWords = ['um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const curveRules = numberWords.flatMap((word, index) => {
      const value = index + 1;
      return [
        { phrase: `direita ${word}`, symbol: `D${value}`, category: 'curvas' },
        { phrase: `direita ${value}`, symbol: `D${value}`, category: 'curvas' },
        { phrase: `esquerda ${word}`, symbol: `E${value}`, category: 'curvas' },
        { phrase: `esquerda ${value}`, symbol: `E${value}`, category: 'curvas' },
      ];
    });

    return [...fixedRules, ...curveRules].map((rule) => ({
      ...rule,
      id: `base:${this.phraseKey(rule.phrase)}`,
      enabled: true,
      base: true,
    }));
  }

  private phraseKey(phrase: string): string {
    return (phrase || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private loadLocalRules(): CustomNoteDictionaryRule[] {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return [];
      const rules = JSON.parse(raw) as CustomNoteDictionaryRule[];
      return Array.isArray(rules) ? rules.map((rule) => this.normalizeRule(rule)) : [];
    } catch {
      return [];
    }
  }

  private persist(rules: CustomNoteDictionaryRule[]): void {
    localStorage.setItem(this.cacheKey, JSON.stringify(rules));
  }
}
