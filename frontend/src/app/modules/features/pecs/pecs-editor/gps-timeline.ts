import { Note } from '../../../core/models/rally';
import { GpsPoint } from '../../../core/services/pecs.service';
import { ClickMarker } from '../../../core/services/tracking.service';

export interface MapNote { id: string; lat: number; lng: number; text: string; timestamp: number | null; }
export function validCoordinate(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
export function timed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Preserve acquisition order. Never bridge invalid samples, track segments or GPS outages. */
export function trackSegments(track: GpsPoint[]): GpsPoint[][] {
  const segments: GpsPoint[][] = [];
  let current: GpsPoint[] = [];
  for (const point of track) {
    if (!validCoordinate(point.lat, point.lng)) { current = []; continue; }
    const previous = current[current.length - 1];
    if (previous && (previous.segment !== point.segment
      || timed(previous.timestamp) !== timed(point.timestamp)
      || (timed(previous.timestamp) && timed(point.timestamp)
        && (point.timestamp <= previous.timestamp || point.timestamp - previous.timestamp > 15)))) current = [];
    if (!current.length) segments.push(current);
    current.push(point);
  }
  return segments;
}

/** No extrapolation, no interpolation across gaps, and no artificial times for untimed GPX. */
export function positionAt(segments: GpsPoint[][], seconds: number): { lat: number; lng: number } | null {
  if (!timed(seconds)) return null;
  for (const segment of segments) {
    for (let i = 0; i < segment.length; i++) {
      const point = segment[i];
      if (!timed(point.timestamp)) continue;
      if (point.timestamp === seconds) return { lat: point.lat, lng: point.lng };
      const next = segment[i + 1];
      if (!next || !timed(next.timestamp) || seconds <= point.timestamp || seconds >= next.timestamp) continue;
      const ratio = (seconds - point.timestamp) / (next.timestamp - point.timestamp);
      // Shortest longitude arc also handles a crossing of the date line.
      const deltaLng = ((next.lng - point.lng + 540) % 360) - 180;
      return { lat: point.lat + (next.lat - point.lat) * ratio, lng: ((point.lng + deltaLng * ratio + 540) % 360) - 180 };
    }
  }
  return null;
}

export function notesOnMap(notes: Note[], markers: ClickMarker[], segments: GpsPoint[][]): MapNote[] {
  return notes.flatMap(note => {
    const legacy = markers.find(marker => timed(note.originalTimestamp) && marker.timestamp === note.originalTimestamp
      && validCoordinate(marker.latitude, marker.longitude));
    const coordinate = validCoordinate(note.latitude, note.longitude) ? { lat: note.latitude!, lng: note.longitude! }
      : legacy ? { lat: legacy.latitude!, lng: legacy.longitude! }
      : timed(note.originalTimestamp) ? positionAt(segments, note.originalTimestamp) : null;
    return coordinate ? [{ id: note.id, ...coordinate, text: note.text, timestamp: note.originalTimestamp }] : [];
  });
}
