import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tutorial.component.html',
})
export class TutorialComponent {
  steps = [
    {
      title: '1. Cria ou escolhe um rali',
      text: 'Comeca nos Meus Ralis, filtra por ativo e entra no rali onde vais trabalhar.',
    },
    {
      title: '2. Adiciona as PECs',
      text: 'Cada PEC deve ter nome, numero e distancia para alimentar os totais do rali.',
    },
    {
      title: '3. Faz reconhecimento',
      text: 'Usa o modo Reconhecimento para marcar notas com GPS mesmo quando estiveres offline.',
    },
    {
      title: '4. Abre o Studio',
      text: 'Carrega video, GPS e notas. Depois ajusta offset e edita notas diretamente no caderno.',
    },
  ];
}
