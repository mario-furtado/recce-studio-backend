import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { DisplayRule, NoteBlock, Position, positions } from './notebook.model';
import { composePresentedNote } from './note-presentation';

export const blockStyles = `
.note-block{display:inline-grid;grid-template-columns:repeat(3,auto);grid-template-rows:repeat(3,auto);align-items:center;gap:0 .12em;padding:.08em .16em;vertical-align:middle;flex-shrink:0;color:inherit;line-height:1.15;white-space:pre}
.note-element{display:inline-block;text-align:center;padding:0 .06em}
.note-highlight{outline:1.5px solid currentColor;outline-offset:1px}
.note-block-holder{display:contents}
`;

@Component({
  selector: 'app-note-block', standalone: true, imports: [CommonModule],
  template: `<span class="note-block"><span *ngFor="let position of positions" [style.gridArea]="area(position)"><span *ngFor="let element of elementsAt(position)" class="note-element"
    [class.note-highlight]="element.highlight"
    [style.fontSize.%]="element.size" [style.fontWeight]="element.bold ? 'bold' : 'normal'"
    [style.textDecoration]="element.underline ? 'underline' : 'none'" [attr.title]="element.meaning">{{ element.display }}</span></span></span>`,
  styles: [blockStyles],
})
export class NoteBlockComponent {
  @Input({ required: true }) block!: NoteBlock;
  readonly positions = positions;
  elementsAt(position: Position) { return this.block.elements.filter(element => element.position === position); }
  area(position: Position): string {
    const areas: Record<Position, string> = { 'top-left': '1 / 1', 'top-center': '1 / 2', 'top-right': '1 / 3', 'middle-left': '2 / 1', center: '2 / 2', 'middle-right': '2 / 3', 'bottom-left': '3 / 1', 'bottom-center': '3 / 2', 'bottom-right': '3 / 3' };
    return areas[position];
  }
}

@Component({
  selector: 'app-note-display', standalone: true, imports: [CommonModule, NoteBlockComponent],
  template: `<span role="group" [attr.aria-label]="text"><span class="display-sequence" aria-hidden="true"><ng-container *ngFor="let block of blocks; let last = last"><br *ngIf="block.breakBefore"><app-note-block [block]="block" /><ng-container *ngIf="!last">{{ ' ' }}</ng-container></ng-container></span></span>`,
  styles: [`.display-sequence{display:flex;align-items:center;flex-wrap:wrap;gap:.3em}.display-sequence br{flex-basis:100%}`],
})
export class NoteDisplayComponent implements OnChanges {
  @Input() text = '';
  @Input() rules: DisplayRule[] = [];
  @Input() presentationJson?: string | null;
  blocks: NoteBlock[] = [];
  ngOnChanges() { this.blocks = composePresentedNote(this.text, this.rules, this.presentationJson); }
}
