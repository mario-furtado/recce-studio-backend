import { Injectable } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { CustomNoteDictionaryRule, NoteDictionaryService } from '../../core/services/note-dictionary.service';
import { TeamProfile, TeamProfileService } from '../../core/services/team-profile.service';
import { defaultNotebook, NotebookSettings } from '../../core/notebook/notebook.model';
import { NotebookService } from '../../core/notebook/notebook.service';

// Intentionally independent of the production services: no HttpClient, cache or storage.
@Injectable()
export class DemoDictionary {
  readonly rules$ = new BehaviorSubject<CustomNoteDictionaryRule[]>([]);
  getDisplayRules() { return this.rules$.value; }
  loadRules() { return of(this.getDisplayRules()); }
  isBaseRule() { return false; }
  isBasePlaceholder() { return false; }
  createRule(rule: CustomNoteDictionaryRule) {
    const saved = { ...rule, id: `example-${this.rules$.value.length + 1}` };
    this.rules$.next([...this.rules$.value, saved]);
    return of(saved);
  }
  updateRule(id: string, rule: CustomNoteDictionaryRule) {
    const saved = { ...rule, id };
    this.rules$.next(this.rules$.value.map(value => value.id === id ? saved : value));
    return of(saved);
  }
  deleteRule(id: string) {
    this.rules$.next(this.rules$.value.filter(value => value.id !== id));
    return of(undefined);
  }
  createLocalRule(rule: CustomNoteDictionaryRule) { this.createRule(rule); }
  updateLocalRule(rule: CustomNoteDictionaryRule) { this.updateRule(rule.id!, rule); }
  deleteLocalRule(id: string) { this.deleteRule(id); }
}

@Injectable()
export class DemoNotebook {
  private saved = defaultNotebook();
  load() { return of(structuredClone(this.saved)); }
  save(settings: NotebookSettings) {
    this.saved = structuredClone(settings);
    return this.load();
  }
}

@Injectable()
export class DemoTeamProfile {
  private profile: TeamProfile = { name: 'Equipa de exemplo', driverName: '', coDriverName: '', noteSystem: 'Exemplo editável 1–6', distanceUnit: 'km' };
  getProfile() { return of({ ...this.profile }); }
  updateProfile(changes: Partial<TeamProfile>) {
    this.profile = { ...this.profile, ...changes };
    return this.getProfile();
  }
}

export const notesDemoProviders = [
  DemoDictionary, DemoNotebook, DemoTeamProfile,
  { provide: NoteDictionaryService, useExisting: DemoDictionary },
  { provide: NotebookService, useExisting: DemoNotebook },
  { provide: TeamProfileService, useExisting: DemoTeamProfile },
];
