import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CoverSide } from './book-cover.model';

export const coverPageStyles = `app-book-cover-page{display:contents}.reccebook-cover{position:relative;box-sizing:border-box;flex-shrink:0;break-after:page;page-break-after:always;font-family:Arial,sans-serif;margin:0 auto;print-color-adjust:exact;-webkit-print-color-adjust:exact}.reccebook-cover.cover-back{break-after:auto;page-break-after:auto}.cover-brand{position:absolute;left:12mm;top:4mm;width:32mm;height:32mm;object-fit:contain;background:white}.cover-editable{position:absolute;top:42mm;bottom:20mm;left:12mm;right:12mm}.cover-item{position:absolute;line-height:1.15;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.cover-signature{position:absolute;bottom:4mm;left:0;right:0;height:10mm;display:flex;align-items:center;justify-content:center;background:white;color:black;font:10pt Arial,sans-serif;white-space:nowrap}`;
@Component({
  selector: 'app-book-cover-page', standalone: true, imports: [CommonModule],
  template: `<section class="reccebook-cover book-sheet" [class.cover-back]="back" [attr.aria-label]="back ? 'Contracapa' : 'Capa'" [style.width.mm]="dimensions[0]" [style.height.mm]="dimensions[1]" [style.backgroundColor]="side.background">
    <img *ngIf="!back" class="cover-brand" [src]="brandUrl" alt="Recce Studio" width="121" height="121" />
    <div class="cover-editable"><p *ngFor="let item of side.elements" class="cover-item" [style.left.%]="item.x" [style.top.%]="item.y" [style.width.%]="item.width" [style.fontSize.pt]="item.fontPt" [style.fontFamily]="item.font" [style.textAlign]="item.align" [style.fontWeight]="item.bold ? 'bold' : 'normal'" [style.fontStyle]="item.italic ? 'italic' : 'normal'" [style.textDecoration]="item.underline ? 'underline' : 'none'" [style.color]="item.color">{{ item.text }}</p></div>
    <p *ngIf="back" class="cover-signature">Official product by Recce Studio</p>
  </section>`,
  styles: [coverPageStyles, '.reccebook-cover{margin:0 auto 12px}'],
})
export class BookCoverPageComponent {
  @Input() side: CoverSide = { background: '#ffffff', elements: [] };
  @Input() dimensions: [number, number] = [210, 297];
  @Input() back = false;
  readonly brandUrl = new URL('/assets/brand/recce-studio-logo-rs.png', document.baseURI).href;
}
