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
}

@Injectable({
  providedIn: 'root',
})
export class NoteDictionaryService {
  private readonly apiUrl = `${API_BASE_URL}/api/note-dictionary-rules`;
  private readonly cacheKey = 'recce_note_dictionary_rules';

  readonly rules$ = new BehaviorSubject<CustomNoteDictionaryRule[]>(this.loadLocalRules());

  constructor(private http: HttpClient) {}

  getActiveRules(): CustomNoteDictionaryRule[] {
    return this.rules$.value.filter((rule) => rule.enabled && !!rule.phrase?.trim() && !!rule.symbol?.trim());
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
    };
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
