import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet/dist/leaflet-src.esm.js';
import { GpsPoint } from '../../../core/services/pecs.service';
import { MapNote, positionAt, trackSegments, validCoordinate } from './gps-timeline';

@Component({
  selector: 'app-recce-map', standalone: true, imports: [CommonModule],
  template: `
    <section #panel class="recce-map surface-card" [class.expanded]="expanded" aria-label="Mapa do reconhecimento">
      <div class="map-toolbar">
        <strong>Mapa de satélite</strong>
        <button type="button" (click)="zoom(1)" aria-label="Aumentar zoom">+</button>
        <button type="button" (click)="zoom(-1)" aria-label="Diminuir zoom">−</button>
        <button type="button" (click)="fit()">Enquadrar traçado</button>
        <button type="button" (click)="toggleExpanded()" [attr.aria-expanded]="expanded">{{expanded ? 'Recolher mapa' : 'Expandir mapa'}}</button>
      </div>
      <div #canvas class="map-canvas" role="region" aria-label="Traçado GPS e notas; use as setas para deslocar e mais ou menos para zoom"></div>
      <p *ngIf="!hasCoordinates">Sem coordenadas GPS disponíveis.</p>
      <p *ngIf="imagesUnavailable" role="status">Algumas imagens de satélite não carregaram. O traçado e as notas continuam disponíveis.
        <button type="button" (click)="retryImages()">Tentar imagens novamente</button>
      </p>
      <p data-testid="gps-position" [attr.data-lat]="vehiclePosition?.lat" [attr.data-lng]="vehiclePosition?.lng" aria-live="off">
        {{ vehiclePosition ? ('Posição GPS: ' + vehiclePosition.lat.toFixed(5) + ', ' + vehiclePosition.lng.toFixed(5)) : 'Sem posição GPS neste instante' }}
      </p>
      <details *ngIf="notes.length"><summary>Notas no mapa ({{notes.length}})</summary>
        <button *ngFor="let note of notes" type="button" (click)="noteSelected.emit(note)" [class.active]="note.id === activeNoteId">{{note.text}}</button>
      </details>
    </section>`,
  styles: [`
    :host { display:block; min-width:0; }
    .recce-map { border-radius:1rem; padding:.75rem; min-width:0; }
    .recce-map.expanded { position:fixed; inset:1rem; width:auto; height:auto; margin:0; z-index:10000; overflow:auto; background:var(--bg,#111827); color:var(--text,#fff); }
    .map-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; margin-bottom:.5rem; }
    button { padding:.3rem .6rem; border:1px solid #64748b; border-radius:.4rem; background:#1e293b; color:#fff; }
    button:focus-visible { outline:3px solid #38bdf8; outline-offset:2px; }
    .map-canvas { height:300px; width:100%; z-index:0; background:#172332; border-radius:.5rem; }
    .expanded .map-canvas { height:calc(100dvh - 12rem); min-height:250px; }
    p { font-size:.75rem; margin-top:.4rem; } details button { margin:.3rem; } .active { outline:3px solid #38bdf8; }
  `],
})
export class RecceMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLDivElement>;
  @ViewChild('panel', { static: true }) panel!: ElementRef<HTMLElement>;
  @Input() track: GpsPoint[] = [];
  @Input() notes: MapNote[] = [];
  @Input() playbackTime = 0;
  @Input() activeNoteId: string | null = null;
  @Output() noteSelected = new EventEmitter<MapNote>();
  expanded = false;
  imagesUnavailable = false;
  vehiclePosition: {lat: number; lng: number} | null = null;
  hasCoordinates = false;
  private map?: L.Map;
  private tiles?: L.TileLayer;
  private routeLayer = L.layerGroup();
  private noteLayer = L.layerGroup();
  private indicator?: L.CircleMarker;
  private segments: GpsPoint[][] = [];
  private renderedTrack?: GpsPoint[];
  private renderedNotes?: MapNote[];
  private buttons = new Map<string, HTMLButtonElement>();
  private resize?: ResizeObserver;

  ngAfterViewInit(): void {
    this.map = L.map(this.canvas.nativeElement, { zoomControl: false, scrollWheelZoom: true }).setView([39, -8], 6);
    L.control.scale({ imperial: false }).addTo(this.map);
    this.routeLayer.addTo(this.map);
    this.noteLayer.addTo(this.map);
    this.resize = new ResizeObserver(() => this.map?.invalidateSize());
    this.resize.observe(this.canvas.nativeElement);
    this.update();
  }
  ngOnChanges(): void {
    this.segments = trackSegments(this.track);
    this.hasCoordinates = this.segments.length > 0 || this.notes.some(note => validCoordinate(note.lat, note.lng));
    this.vehiclePosition = positionAt(this.segments, this.playbackTime);
    this.update();
  }
  private update(): void {
    if (!this.map) return;
    const geometryChanged = this.renderedTrack !== this.track || this.renderedNotes !== this.notes;
    if (geometryChanged) {
      this.renderedTrack = this.track; this.renderedNotes = this.notes;
      this.segments = trackSegments(this.track);
      this.routeLayer.clearLayers(); this.noteLayer.clearLayers(); this.buttons.clear();
      for (const segment of this.segments) {
        L.polyline(segment.map(p => [p.lat, p.lng] as L.LatLngTuple), { color: '#fbbf24', weight: 4 }).addTo(this.routeLayer);
      }
      for (const [index, note] of this.notes.entries()) {
        if (!validCoordinate(note.lat, note.lng)) continue;
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = note.text;
        button.className = 'recce-map-note'; button.setAttribute('aria-label', `Nota: ${note.text}`);
        button.dataset['noteId'] = note.id;
        L.DomEvent.disableClickPropagation(button);
        button.addEventListener('click', () => this.noteSelected.emit(note));
        this.buttons.set(note.id, button);
        L.circleMarker([note.lat, note.lng], { radius: 4, color: '#111827', fillColor: '#fbbf24', fillOpacity: 1 })
          .on('click', () => this.noteSelected.emit(note)).addTo(this.noteLayer);
        // Offset labels, never the measured GPS point. Alternate above/below to reduce overlap.
        L.marker([note.lat, note.lng], { keyboard: false, riseOnHover: true,
          icon: L.divIcon({ html: button, className: 'recce-map-note-icon', iconSize: undefined,
            iconAnchor: [0, index % 2 ? 36 : -10] }) }).addTo(this.noteLayer);
      }
      this.hasCoordinates = this.segments.length > 0 || this.buttons.size > 0;
      if (this.hasCoordinates && !this.tiles) {
        this.tiles = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          minZoom: 1, maxZoom: 19,
          attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community | <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer">World Imagery</a>',
        }).on('tileerror', () => { this.imagesUnavailable = true; }).addTo(this.map);
      }
      this.fit();
    }
    this.vehiclePosition = positionAt(this.segments, this.playbackTime);
    if (this.vehiclePosition) {
      const coordinates: L.LatLngTuple = [this.vehiclePosition.lat, this.vehiclePosition.lng];
      if (!this.indicator) this.indicator = L.circleMarker(coordinates, { radius: 8, color: '#fff', fillColor: '#06b6d4', fillOpacity: 1 }).addTo(this.map);
      else this.indicator.setLatLng(coordinates).addTo(this.map);
    } else this.indicator?.remove();
    for (const [id, button] of this.buttons) button.classList.toggle('is-active', id === this.activeNoteId);
  }
  zoom(delta: number): void { if (delta > 0) this.map?.zoomIn(); else this.map?.zoomOut(); }
  fit(): void {
    const coordinates: L.LatLngTuple[] = [...this.segments.flat().map(p => [p.lat, p.lng] as L.LatLngTuple),
      ...this.notes.filter(p => validCoordinate(p.lat, p.lng)).map(p => [p.lat, p.lng] as L.LatLngTuple)];
    if (coordinates.length) this.map?.fitBounds(L.latLngBounds(coordinates), { padding: [30, 30], maxZoom: 17 });
  }
  toggleExpanded(): void {
    if (this.expanded) { this.closeExpanded(); return; }
    const panel = this.panel.nativeElement;
    // The top layer avoids clipping/stacking caused by the Studio glass panels and sidebar.
    panel.setAttribute('popover', 'manual');
    panel.showPopover();
    this.expanded = true;
  }
  @HostListener('document:keydown.escape') closeExpanded(): void {
    if (!this.expanded) return;
    this.panel.nativeElement.hidePopover();
    this.panel.nativeElement.removeAttribute('popover');
    this.expanded = false;
  }
  retryImages(): void { this.imagesUnavailable = false; this.tiles?.redraw(); }
  ngOnDestroy(): void { this.closeExpanded(); this.resize?.disconnect(); this.map?.remove(); this.map = undefined; }
}
