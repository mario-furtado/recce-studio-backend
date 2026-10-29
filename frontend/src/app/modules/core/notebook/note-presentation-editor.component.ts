import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DisplayRule, positions } from './notebook.model';
import { ElementStyle, NotePresentation, presentationElements, presentationError } from './note-presentation';

@Component({
  selector: 'app-note-presentation-editor', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <details><summary>Apresentação desta nota</summary>
      <p class="text-xs my-2">Só nesta ocorrência.</p>
      <label class="block">Elemento da nota
        <select aria-label="Elemento da nota" class="themed-input w-full" [(ngModel)]="selected"><option *ngFor="let item of elements; let at = index" [ngValue]="at">{{ item.match }} · ocorrência {{ item.occurrence + 1 }}</option></select>
      </label>
      <div *ngIf="elements[selected] as item" class="space-y-2 mt-2">
        <label class="block">Posição nesta nota<select aria-label="Posição nesta nota" class="themed-input w-full" [(ngModel)]="item.position" (ngModelChange)="update(item)"><option *ngFor="let position of positions; let at = index" [value]="position">{{ labels[at] }}</option></select></label>
        <label class="block">Tamanho nesta nota (%)<input class="themed-input w-full" type="number" min="50" max="150" step="1" [(ngModel)]="item.size" (ngModelChange)="update(item)"></label>
        <label class="block"><input type="checkbox" [(ngModel)]="item.bold" (ngModelChange)="update(item)"> Negrito nesta nota</label>
        <label class="block"><input type="checkbox" [(ngModel)]="item.underline" (ngModelChange)="update(item)"> Sublinhado nesta nota</label>
        <label class="block"><input type="checkbox" [(ngModel)]="item.highlight" (ngModelChange)="update(item)"> Destaque nesta nota</label>
      </div>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <button type="button" class="soft-button px-3 py-2 rounded" [disabled]="!value" (click)="valueChange.emit(null)">Repor apresentação do modelo</button>
    </details>`,
})
export class NotePresentationEditorComponent implements OnChanges {
  @Input() text = '';
  @Input() rules: DisplayRule[] = [];
  @Input() value: string | null = null;
  @Output() valueChange = new EventEmitter<string | null>();
  readonly positions = positions;
  readonly labels = ['Superior esquerda', 'Superior centro', 'Superior direita', 'Centro esquerda', 'Centro', 'Centro direita', 'Inferior esquerda', 'Inferior centro', 'Inferior direita'];
  selected = 0;
  elements: ElementStyle[] = [];
  get error() { return presentationError(this.text, this.value); }
  ngOnChanges() {
    this.elements = presentationElements(this.text, this.rules, this.value);
    if (this.selected >= this.elements.length) this.selected = 0;
  }
  update(item: ElementStyle) {
    const previous: NotePresentation = this.value && !this.error ? JSON.parse(this.value) : { version: 1, text: this.text, elements: [] };
    const elements = previous.elements.filter(style => style.match !== item.match || style.occurrence !== item.occurrence);
    elements.push({ ...item });
    this.valueChange.emit(JSON.stringify({ version: 1, text: this.text, elements }));
  }
}
