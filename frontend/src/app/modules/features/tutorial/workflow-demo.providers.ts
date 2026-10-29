import { Injectable } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { NewPec, Pec, Rally } from '../../core/models/rally';
import { RallyService } from '../../core/services/rally.service';
import { PecService } from '../../core/services/pecs.service';
import { TeamProfileService } from '../../core/services/team-profile.service';
import { SharedProperties } from '../../core/shared/shared-properties';

/** A new instance per demo. Never inherits production services or accesses storage/HTTP. */
@Injectable()
export class WorkflowDemoStore {
  rallies: Rally[] = [];
  pecs: Pec[] = [];
  readonly exampleRally: Rally = { id: 'example-rally', name: 'Rali de exemplo', year: 2026, surface: 'TERRA', location: 'Serra de exemplo', icon: 'RS', status: 'DRAFT' };
  getRallies() { return of(structuredClone(this.rallies)); }
  getRallyById() { return of(structuredClone(this.exampleRally)); }
  getRallyPecs() { return of(structuredClone(this.pecs)); }
  getRallyLogoUrl() { return null; }
  createRally(value: Omit<Rally, 'id'>) {
    const created = { ...value, id: 'example-created-rally' };
    this.rallies = [structuredClone(created)]; return of(structuredClone(created));
  }
  postRallyPec(_id: string, value: NewPec) {
    const created: Pec = { ...value, id: 'example-pec', updatedAt: '2026-01-01T00:00:00Z' };
    this.pecs = [structuredClone(created)]; return of(structuredClone(created));
  }
  reset() { this.rallies = []; this.pecs = []; }
}

export const workflowDemoProviders = [
  WorkflowDemoStore,
  { provide: RallyService, useExisting: WorkflowDemoStore },
  { provide: PecService, useValue: Object.freeze({}) },
  { provide: TeamProfileService, useValue: { getCars: () => of([{ id: 'example-car', name: 'Carro de exemplo', carClass: 'Rally2' }]) } },
  { provide: SharedProperties, useFactory: () => ({ connectionMode$: new BehaviorSubject('online'), success: () => {}, error: () => {}, info: () => {} }) },
  { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'example-rally' }) } } },
];
