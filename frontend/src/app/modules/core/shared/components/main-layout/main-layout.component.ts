import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SharedProperties } from '../../shared-properties';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  template: `
    <div class="app-shell flex min-h-screen text-slate-100 font-sans">
      <app-sidebar></app-sidebar>

      <main class="flex-1 p-6 md:p-8 overflow-y-auto">
        <router-outlet></router-outlet>
      </main>

      <div class="fixed top-5 right-5 z-50 w-[min(24rem,calc(100vw-2rem))] space-y-3">
        <div
          *ngFor="let toast of shared.toasts$ | async"
          class="toast-enter glass-panel rounded-xl p-4 flex items-start gap-3"
          [class.border-emerald-500]="toast.type === 'success'"
          [class.border-red-500]="toast.type === 'error'"
          [class.border-sky-500]="toast.type === 'info'"
        >
          <div
            class="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
            [class.bg-emerald-400]="toast.type === 'success'"
            [class.bg-red-400]="toast.type === 'error'"
            [class.bg-sky-400]="toast.type === 'info'"
          ></div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-bold text-white">{{ toast.title }}</div>
            <div *ngIf="toast.message" class="text-xs text-slate-400 mt-0.5">
              {{ toast.message }}
            </div>
          </div>
          <button
            type="button"
            (click)="shared.dismissToast(toast.id)"
            class="text-slate-500 hover:text-white transition"
          >
            x
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MainLayoutComponent {
  constructor(public shared: SharedProperties) {}
}
