export interface Pec {
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
  startDate?: string;
  isExpanded?: boolean;
  pecs?: Pec[];
}

export interface Note {
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
  pecs: Pec[];
}
