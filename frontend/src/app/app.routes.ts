import { Routes } from '@angular/router';
import { MainLayoutComponent } from './modules/core/shared/components/main-layout/main-layout.component';

// Componentes Core / Públicos
import { LandingPageComponent } from './modules/core/components/landing-page/landing-page.component';
import { LoginComponent } from './modules/core/components/login/login.component';
import { PecsListComponent } from './modules/features/pecs/pecs-list/pecs-list.component';
import { PecsEditorComponent } from './modules/features/pecs/pecs-editor/pecs-editor.component';
import { RallyDetailComponent } from './modules/features/pecs/rally-detail/rally-detail.component';
import { RecceModeComponent } from './modules/features/recce-mode/recce-mode.component';
import { PecDetailComponent } from './modules/features/pecs/pec-detail/pec-detail.component';
import { TeamProfileComponent } from './modules/features/team-profile/team-profile.component';
import { SettingsComponent } from './modules/features/settings/settings.component';
import { authGuard } from './modules/core/guards/auth.guard';
import { TutorialComponent } from './modules/features/tutorial/tutorial.component';
import { OfflineReccesComponent } from './modules/features/offline-recces/offline-recces.component';
import { NotesComponent } from './modules/features/notes/notes.component';

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
      { path: 'pecs', component: PecsListComponent }, // Lista de PECs/Ralis
      { path: 'new-recce', component: PecsEditorComponent }, // Form para Criar PEC (trocar pelo teu comp)
      { path: 'recce/:id', component: PecDetailComponent }, // Editor com Player + Mapa (trocar pelo teu comp)
      { path: 'rally/:id', component: RallyDetailComponent },
      { path: 'recce-mode', component: RecceModeComponent },
      { path: 'offline-recces', component: OfflineReccesComponent },
      { path: 'notes', component: NotesComponent },
      { path: 'team-profile', component: TeamProfileComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'tutorial', component: TutorialComponent },
    ],
  },

  // Redirecionamento por omissão se a rota não existir
  { path: '**', redirectTo: '' },
];
