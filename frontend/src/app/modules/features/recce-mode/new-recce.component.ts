import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-new-recce',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="glass-panel max-w-3xl mx-auto p-6 rounded-2xl space-y-5">
      <h1 class="text-2xl font-bold">Novo reconhecimento</h1>
      <p>Escolhe como queres começar. Nenhuma PEC é aberta automaticamente.</p>
      <div class="space-y-2">
        <a routerLink="/pecs" class="accent-button inline-block px-4 py-2 rounded-xl">Escolher ou criar uma PEC</a>
        <p>Abre um rali, escolhe ou cria a PEC e entra em Reconhecimento.</p>
      </div>
      <div class="space-y-2">
        <a routerLink="/recce-mode" class="soft-button inline-block px-4 py-2 rounded-xl">Iniciar sem PEC</a>
        <p>Grava localmente e escolhe ou cria a PEC quando sincronizares.</p>
      </div>
    </section>
  `,
})
export class NewRecceComponent {}
