import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SharedProperties } from '../../core/shared/shared-properties';
import { GuidedTourComponent } from './guided-tour.component';
import { WorkflowDemoComponent } from './workflow-demo.component';
import { WorkflowGuide, WorkflowKind, workflowGuides } from './workflow-tour.steps';

@Component({
  selector: 'app-workflow-tour', standalone: true,
  imports: [CommonModule, RouterLink, GuidedTourComponent, WorkflowDemoComponent],
  template: `
    <ng-container *ngIf="guide; else unavailable">
      <app-workflow-demo [kind]="kind" [index]="index" />
      <app-guided-tour [name]="guide.name" [title]="guide.steps[index].title" [description]="guide.steps[index].text"
        [target]="guide.steps[index].target" [index]="index" [total]="guide.steps.length" [practiceLabel]="practiceLabel"
        (next)="next()" (previous)="previous()" (exit)="leave()" (practice)="leave(true)" />
    </ng-container>
    <ng-template #unavailable><section class="glass-panel p-5 rounded-2xl"><h1>Tutorial indisponível</h1><p>Escolhe um dos percursos disponíveis.</p><a routerLink="/tutorial" class="soft-button px-3 py-2 rounded">Voltar aos tutoriais</a></section></ng-template>`,
})
export class WorkflowTourComponent implements OnInit, OnDestroy {
  guide?: WorkflowGuide;
  kind: WorkflowKind = 'rally';
  index = 0;
  private readonly subscriptions = new Subscription();
  get practiceLabel() { return this.shared.connectionMode$.value === 'offline' ? 'Ir para reconhecimentos offline' : this.guide?.practice ?? 'Experimentar'; }
  constructor(private route: ActivatedRoute, private router: Router, private shared: SharedProperties) {}
  ngOnInit() {
    this.subscriptions.add(this.route.paramMap.subscribe(params => {
      const key = params.get('workflow') || '';
      this.guide = workflowGuides.get(key); this.index = 0;
      if (this.guide) this.kind = key as WorkflowKind;
    }));
  }
  next() { if (this.guide && this.index < this.guide.steps.length - 1) this.index++; }
  previous() { if (this.index > 0) this.index--; }
  leave(practice = false) {
    const path = !practice ? '/tutorial' : this.shared.connectionMode$.value === 'offline' || this.kind === 'offline' ? '/offline-recces' : this.kind === 'team' ? '/team-profile' : this.kind === 'recce' ? '/new-recce' : '/pecs';
    void this.router.navigateByUrl(path).then(navigated => {
      if (!navigated) return;
      const heading = document.querySelector<HTMLElement>('main h1');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  }
  ngOnDestroy() { this.subscriptions.unsubscribe(); }
}
