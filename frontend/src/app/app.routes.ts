import { Routes } from '@angular/router';
import { MainLayoutComponent } from './modules/core/shared/components/main-layout/main-layout.component';

// Componentes Core / Públicos
import { LoginComponent } from './modules/core/components/login/login.component';
import { authGuard } from './modules/core/guards/auth.guard';
import { recceExitGuard } from './modules/core/guards/recce-exit.guard';

export const routes: Routes = [
  // 1. Rota Pública de Login (Sem Sidebar)
  { path: 'login', component: LoginComponent },

  // 3. Área Privada do Studio (Com Sidebar mantida pelo MainLayoutComponent)
  {
    path: '',
    component: MainLayoutComponent, // Este componente tem a Sidebar + <router-outlet>
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'pecs', pathMatch: 'full' },
      { path: 'pecs', loadComponent: () => import('./modules/features/pecs/pecs-list/pecs-list.component').then(m => m.PecsListComponent) }, // Lista de PECs/Ralis
      { path: 'new-recce', loadComponent: () => import('./modules/features/recce-mode/new-recce.component').then(m => m.NewRecceComponent) },
      { path: 'recce/:id', loadComponent: () => import('./modules/features/pecs/pec-detail/pec-detail.component').then(m => m.PecDetailComponent), canDeactivate: [recceExitGuard] }, // Editor com Player + Mapa (trocar pelo teu comp)
      { path: 'rally/:id', loadComponent: () => import('./modules/features/pecs/rally-detail/rally-detail.component').then(m => m.RallyDetailComponent) },
      { path: 'recce-mode', loadComponent: () => import('./modules/features/recce-mode/recce-mode.component').then(m => m.RecceModeComponent), canDeactivate: [recceExitGuard] },
      { path: 'offline-recces', loadComponent: () => import('./modules/features/offline-recces/offline-recces.component').then(m => m.OfflineReccesComponent) },
      { path: 'notes/learn', loadComponent: () => import('./modules/features/tutorial/notes-tour.component').then(m => m.NotesTourComponent) },
      { path: 'tutorial/notes', loadComponent: () => import('./modules/features/tutorial/notes-tour.component').then(m => m.NotesTourComponent) },
      { path: 'tutorial/learn/:workflow', loadComponent: () => import('./modules/features/tutorial/workflow-tour.component').then(m => m.WorkflowTourComponent) },
      { path: 'notes', loadComponent: () => import('./modules/features/notes/notes.component').then(m => m.NotesComponent), canDeactivate: [recceExitGuard] },
      { path: 'team-profile', loadComponent: () => import('./modules/features/team-profile/team-profile.component').then(m => m.TeamProfileComponent) },
      { path: 'settings', loadComponent: () => import('./modules/features/settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'tutorial', loadComponent: () => import('./modules/features/tutorial/tutorial.component').then(m => m.TutorialComponent) },
    ],
  },

  // Redirecionamento por omissão se a rota não existir
  { path: '**', redirectTo: '' },
];
