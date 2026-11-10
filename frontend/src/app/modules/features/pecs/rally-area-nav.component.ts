import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-rally-area-nav',
  imports: [RouterLink],
  template: `
    <nav class="flex flex-wrap gap-2" aria-label="Áreas de ralis">
      @if (!personalAccount) {
        <a class="soft-button px-3 py-2 rounded-lg" routerLink="/pecs"
           [attr.aria-current]="area() === 'own' ? 'page' : null">Os meus ralis</a>
      }
      <a class="soft-button px-3 py-2 rounded-lg" routerLink="/shared-rallies"
         [attr.aria-current]="area() === 'own' ? null : area() === 'shared' ? 'page' : 'location'">Ralis partilhados</a>
      <a class="soft-button px-3 py-2 rounded-lg" routerLink="/account">Escolher tripulação</a>
    </nav>
  `,
  styles: [`[aria-current] { border-color: currentColor; font-weight: 700; }`],
})
export class RallyAreaNavComponent {
  readonly area = input.required<'own' | 'shared' | 'shared-detail'>();
  private readonly auth = inject(AuthService);

  get personalAccount(): boolean { return this.auth.isPersonalAccount(); }
}
