import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

type AssetKind = 'video' | 'audio' | 'gpx';
let nextAssetPicker = 0;

@Component({
  selector: 'app-studio-assets', standalone: true, imports: [CommonModule],
  template: `
    <h2 class="text-base font-semibold">Ficheiros da PEC</h2>
    <p *ngIf="locked" class="asset-help">{{ blockedReason }}</p>
    <section *ngFor="let row of rows" class="asset-section">
      <header><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="row.icon" /></svg><h3>{{ row.title }}</h3><span class="asset-status" [class.asset-ready]="has(row.kind)">{{ has(row.kind) ? 'Associado' : 'Sem ficheiro' }}</span></header>
      <p *ngIf="has(row.kind)" class="asset-name" [title]="name(row.kind)">{{ name(row.kind) }}</p>
      <div class="asset-tools">
        <label class="asset-picker" [class.asset-disabled]="locked" [for]="id + row.kind">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" /></svg><span>{{ action(row.kind) }}</span>
          <input class="sr-only" [id]="id + row.kind" type="file" [accept]="row.accept" [attr.aria-label]="action(row.kind)" [disabled]="locked" (change)="selected.emit({kind: row.kind, event: $event})">
        </label>
        <button *ngIf="row.kind !== 'gpx' && has(row.kind)" type="button" class="asset-delete" [disabled]="locked" (click)="removed.emit(row.kind === 'video' ? 'video' : 'audio')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg>Eliminar {{ row.kind === 'video' ? 'vídeo' : 'áudio' }}</button>
      </div>
    </section>
    <section class="asset-section">
      <header><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" /></svg><h3>Notas</h3><span class="asset-status">{{ notesCount }} {{ notesCount === 1 ? 'nota' : 'notas' }}</span></header>
      <div class="asset-tools"><label class="asset-picker" [class.asset-disabled]="locked" [for]="id + 'notes'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" /></svg>Importar notas<input [id]="id + 'notes'" class="sr-only" type="file" aria-label="Importar notas" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" [disabled]="locked" (change)="notesSelected.emit($event)"></label></div>
    </section>
    <footer class="asset-footer">
      <h3>Excel</h3><p class="asset-help">{{ notesCount ? 'Notas da PEC num ficheiro editável.' : 'Modelo para preparar as tuas notas.' }}</p>
      <div class="asset-tools"><button type="button" class="asset-download" (click)="download.emit()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>{{ notesCount ? 'Exportar notas em Excel' : 'Descarregar modelo Excel' }}</button></div>
    </footer>`,
  styles: [`
    :host{display:block;color:#eef2f7;font-size:14px;line-height:1.5}h3{font-weight:600;margin:0}.asset-section{padding:14px 0;border-bottom:1px solid #48576c}.asset-section header{display:flex;align-items:center;gap:8px}.asset-status{margin-left:auto;font-size:12px;color:#c3cfdf}.asset-ready{color:#b3ebc9}.asset-name,.asset-help{color:#c3cfdf;font-size:13px;margin:6px 0;overflow-wrap:anywhere}.asset-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.asset-picker,.asset-tools button{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;max-width:100%;width:auto;margin:0;padding:8px 12px;border:1px solid #7889a1;border-radius:8px;background:#253247;color:#eef2f7;font:inherit;cursor:pointer}.asset-picker:focus-within,.asset-tools button:focus-visible{outline:3px solid #ff8da0;outline-offset:2px}.asset-picker:hover:not(.asset-disabled),.asset-tools button:hover:not(:disabled){background:#35445c}.asset-tools .asset-delete{color:#ffe4eb;background:#4c1525;border-color:#ef708c}.asset-tools .asset-delete:hover:not(:disabled){background:#6c2035}.asset-disabled,.asset-tools button:disabled{opacity:.55;cursor:not-allowed}.asset-footer{padding-top:16px}svg{width:18px;height:18px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  `],
})
export class StudioAssetsComponent {
  @Input() hasVideo = false;
  @Input() hasAudio = false;
  @Input() hasGps = false;
  @Input() videoName = '';
  @Input() audioName = '';
  @Input() gpsName = '';
  @Input() notesCount = 0;
  @Input() locked = false;
  @Input() blockedReason = '';
  @Output() selected = new EventEmitter<{ kind: AssetKind; event: Event }>();
  @Output() notesSelected = new EventEmitter<Event>();
  @Output() removed = new EventEmitter<'video' | 'audio'>();
  @Output() download = new EventEmitter<void>();
  readonly id = `studio-file-${++nextAssetPicker}-`;
  readonly rows: { kind: AssetKind; title: string; accept: string; icon: string }[] = [
    { kind: 'video', title: 'Vídeo', accept: 'video/*', icon: 'M3 5h12v14H3zM15 9l6-3v12l-6-3' },
    { kind: 'audio', title: 'Áudio', accept: 'audio/*', icon: 'M9 3h6v10H9zM5 10v3a7 7 0 0 0 14 0v-3M12 20v3' },
    { kind: 'gpx', title: 'GPS', accept: '.gpx,.json,application/json', icon: 'M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12ZM12 6v6M9 9h6' },
  ];
  has(kind: AssetKind) { return kind === 'video' ? this.hasVideo : kind === 'audio' ? this.hasAudio : this.hasGps; }
  name(kind: AssetKind) { return (kind === 'video' ? this.videoName : kind === 'audio' ? this.audioName : this.gpsName) || 'Ficheiro associado à PEC'; }
  action(kind: AssetKind) { return kind === 'gpx' ? (this.hasGps ? 'Substituir GPS' : 'Adicionar GPS') : `${this.has(kind) ? 'Substituir' : 'Adicionar'} ${kind === 'video' ? 'vídeo' : 'áudio'}`; }
}
