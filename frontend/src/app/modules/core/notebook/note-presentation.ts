import { composeNote, DisplayRule, NoteBlock, Position, positions } from './notebook.model';

export interface ElementStyle {
  match: string; occurrence: number; position: Position; size: number;
  bold: boolean; underline: boolean; highlight: boolean;
}
export interface NotePresentation { version: 1; text: string; elements: ElementStyle[] }

export function presentationError(text: string, raw?: string | null): string | null {
  if (raw == null) return null;
  try {
    const value = JSON.parse(raw) as NotePresentation;
    const fields = (item: object, allowed: string[]) => item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).every(key => allowed.includes(key));
    if (raw.length > 30000 || !fields(value, ['version', 'text', 'elements']) || value.version !== 1 || value.text !== text || text.length > 10000
      || !Array.isArray(value.elements) || value.elements.length > 250) throw new Error();
    const keys = new Set<string>();
    for (const item of value.elements) {
      if (!fields(item, ['match', 'occurrence', 'position', 'size', 'bold', 'underline', 'highlight']) || typeof item.match !== 'string'
        || !item.match.trim() || item.match.length > 200 || /[\x00-\x1f]/.test(item.match)
        || !Number.isInteger(item.occurrence) || item.occurrence < 0 || item.occurrence > 249
        || !positions.includes(item.position) || !Number.isInteger(item.size) || item.size < 50 || item.size > 150
        || [item.bold, item.underline, item.highlight].some(flag => typeof flag !== 'boolean')
        || keys.has(JSON.stringify([item.match, item.occurrence]))) throw new Error();
      keys.add(JSON.stringify([item.match, item.occurrence]));
    }
    return null;
  } catch { return 'Apresentação inválida. Usa tamanhos inteiros de 50 a 150% ou repõe o modelo.'; }
}

export function presentationElements(text: string, rules: DisplayRule[], raw?: string | null): ElementStyle[] {
  const seen = new Map<string, number>();
  return composePresentedNote(text, rules, raw).flatMap(block => block.elements).map(element => {
    const occurrence = seen.get(element.match) ?? 0; seen.set(element.match, occurrence + 1);
    return { match: element.match, occurrence, position: element.position, size: element.size, bold: element.bold, underline: element.underline, highlight: element.highlight };
  });
}

/** Clone the base composition; overrides never mutate rules or another note. */
export function composePresentedNote(text: string, rules: DisplayRule[], raw?: string | null): NoteBlock[] {
  const blocks = composeNote(text, rules);
  if (!raw || presentationError(text, raw)) return blocks;
  const presentation = JSON.parse(raw) as NotePresentation;
  const seen = new Map<string, number>();
  for (const block of blocks) for (const element of block.elements) {
    const occurrence = seen.get(element.match) ?? 0; seen.set(element.match, occurrence + 1);
    const style = presentation.elements.find(item => item.match === element.match && item.occurrence === occurrence);
    if (style) Object.assign(element, { position: style.position, size: style.size, bold: style.bold, underline: style.underline, highlight: style.highlight });
  }
  return blocks;
}
