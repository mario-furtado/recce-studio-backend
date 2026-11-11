export interface Pec {
  recceVideoOffsetSeconds?: number;
  id: string;
  number: number;
  name: string;
  distanceKm: number;
  totalNotes: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'DRAFT' | 'PENDING_VIDEO';
  updatedAt: string;
}

export interface NewPec {
  number: number;
  name: string;
  distanceKm: number;
  totalNotes: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'DRAFT' | 'PENDING_VIDEO';
}

export interface Rally {
  id: string;
  name: string;
  year: number;
  surface: 'TERRA' | 'ASFALTO' | 'NEVE' | 'MISTO';
  location: string;
  icon: string;
  logoFileName?: string;
  logoUrl?: string;
  logoStoragePath?: string;
  carId?: string;
  carClass?: string;
  pecsCount?: number;
  status?: 'DRAFT' | 'COMPLETED';
  archivedAt?: number | null;
  archiveManageable?: boolean;
  startDate?: string;
  isExpanded?: boolean;
  pecs?: Pec[];
}

export type RallySummary = Pick<Rally, 'id' | 'name' | 'surface' | 'status' | 'archivedAt'>;

export function rallyStateLabel(rally: RallySummary): string {
  return rally.archivedAt != null ? 'Arquivado' : rally.status === 'COMPLETED' ? 'Concluído' : 'Em preparação';
}

export interface Note {
  presentationJson?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  id: string;
  originalTimestamp: number | null; // Tempo em segundos gravado na app móvel
  text: string; // Ex: "D4 c/ salto"
  speedRating?: string;
}

export interface RallyDetail {
  id: string;
  name: string;
  year: number;
  surface: 'TERRA' | 'ASFALTO' | 'NEVE' | 'MISTO';
  location: string;
  icon: string;
  logoFileName?: string;
  logoUrl?: string;
  logoStoragePath?: string;
  carId?: string;
  carClass?: string;
  pecsCount?: number;
  status?: 'DRAFT' | 'COMPLETED';
  archivedAt?: number | null;
  archiveManageable?: boolean;
  pecs: Pec[];
}
