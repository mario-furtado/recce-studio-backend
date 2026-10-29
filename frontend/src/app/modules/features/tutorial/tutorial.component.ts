import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SharedProperties } from '../../core/shared/shared-properties';
import { workflowGuides } from './workflow-tour.steps';

@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tutorial.component.html',
})
export class TutorialComponent {
  constructor(public shared: SharedProperties) {}
  readonly workflows = Array.from(workflowGuides, ([key, guide]) => ({ key, name: guide.name, steps: guide.steps.length }));
}
