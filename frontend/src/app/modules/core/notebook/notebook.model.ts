export const positions = ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const;
export type Position = typeof positions[number];
export type NotebookAlignment = 'left' | 'center' | 'right';
export interface DisplayRule {
  match: string;
  display: string;
  meaning: string;
  role: 'main' | 'modifier' | 'standalone';
  attach: 'previous' | 'next' | 'standalone';
  position: Position;
  size: number;
  bold: boolean;
  underline: boolean;
  highlight: boolean;
}
export interface NotebookSettings {
  version: 1;
  rules: DisplayRule[];
  page: { format: 'A4' | 'A5'; orientation: 'portrait' | 'landscape'; marginMm: number; rowsPerPage: number; fontPt: number; separators: boolean; alignment?: NotebookAlignment };
}
export interface NoteBlock { elements: DisplayRule[]; breakBefore?: boolean }
export interface NotebookNote { text: string; speedRating?: string; presentationJson?: string | null }

export function displayRule(match = '', role: DisplayRule['role'] = 'standalone'): DisplayRule {
  return { match, display: match, meaning: '', role, attach: role === 'modifier' ? 'previous' : 'standalone', position: 'center', size: 100, bold: role === 'main', underline: false, highlight: false };
}

export function defaultNotebook(): NotebookSettings {
  const rules: DisplayRule[] = [];
  for (const direction of ['E', 'D']) for (let number = 1; number <= 9; number++) {
    rules.push({ ...displayRule(`${direction}${number}`, 'main'), meaning: 'Curva — significado definido pela equipa' });
  }
  for (const match of ['++', '+', '--', '-']) rules.push({ ...displayRule(match, 'modifier'), position: 'top-right', size: 60 });
  for (const match of ['nt', 'NC']) rules.push({ ...displayRule(match, 'modifier'), position: 'bottom-right', size: 60 });
  rules.push({ ...displayRule('ATT', 'modifier'), attach: 'next', position: 'bottom-left', size: 70, highlight: true });
  return { version: 1, rules, page: { format: 'A4', orientation: 'portrait', marginMm: 12, rowsPerPage: 8, fontPt: 24, separators: true, alignment: 'center' } };
}

export function settingsError(settings: NotebookSettings): string | null {
  if (settings.version !== 1) return 'Versão do modelo não suportada.';
  const integer = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
  const page = settings.page;
  if (!['A4', 'A5'].includes(page.format) || !['portrait', 'landscape'].includes(page.orientation)
    || !integer(page.marginMm, 5, 30) || !integer(page.rowsPerPage, 1, 24) || !integer(page.fontPt, 12, 48)
    || (page.alignment !== undefined && !['left', 'center', 'right'].includes(page.alignment))) {
    return 'Página inválida: margens 5–30 mm, 1–24 linhas e letra 12–48 pt (valores inteiros).';
  }
  if (settings.rules.length > 250) return 'O dicionário permite até 250 elementos.';
  const matches = new Set<string>();
  for (const rule of settings.rules) {
    if (!rule.match.trim() || rule.match !== rule.match.trim() || rule.match.length > 40 || matches.has(rule.match)
      || !rule.display.trim() || rule.display.length > 64 || rule.meaning.length > 200
      || /[\x00-\x1f]/.test(rule.match + rule.display) || !positions.includes(rule.position)
      || !['main', 'modifier', 'standalone'].includes(rule.role) || !['previous', 'next', 'standalone'].includes(rule.attach)
      || !integer(rule.size, 50, 150)) return 'Dicionário inválido: usa correspondências únicas, texto válido e tamanho entre 50 e 150%.';
    matches.add(rule.match);
  }
  return null;
}

/** Longest literal match. Unknown text is retained, with no inferred rally meaning. */
export function composeNote(text: string, rules: DisplayRule[]): NoteBlock[] {
  const sorted = [...rules].filter(rule => rule.match).sort((a, b) => b.match.length - a.match.length);
  const blocks: NoteBlock[] = [];
  let main: NoteBlock | undefined;
  let pending: DisplayRule[] = [];
  let breakBefore = false;
  const push = (elements: DisplayRule[]) => {
    const block: NoteBlock = { elements, breakBefore };
    blocks.push(block); breakBefore = false; return block;
  };
  const flush = () => { if (pending.length) { push(pending); pending = []; } };
  for (let at = 0; at < text.length;) {
    if (text[at] === '\n') { flush(); main = undefined; breakBefore = true; at++; continue; }
    if (/\s/.test(text[at])) { at++; continue; }
    const matchAt = (index: number) => sorted.find(rule => {
      if (!text.startsWith(rule.match, index)) return false;
      const word = /[\p{L}\p{N}]/u;
      const last = rule.match.at(-1)!;
      return !(word.test(last) && word.test(text[index + rule.match.length] || ' '))
        && !(word.test(rule.match[0]) && index > 0 && word.test(text[index - 1]));
    });
    const rule = matchAt(at);
    if (rule) {
      at += rule.match.length;
      const element = { ...rule };
      if (rule.role === 'main') { main = push([...pending, element]); pending = []; }
      else if (rule.role === 'modifier' && rule.attach === 'next') pending.push(element);
      else if (rule.role === 'modifier' && rule.attach === 'previous' && main) main.elements.push(element);
      else { flush(); push([element]); main = undefined; }
    } else {
      const start = at++;
      while (at < text.length && !/\s/.test(text[at]) && !matchAt(at)) at++;
      flush(); push([displayRule(text.slice(start, at))]); main = undefined;
    }
  }
  flush(); return blocks;
}

export function pageDimensions(settings: NotebookSettings): [number, number] {
  const dimensions: [number, number] = settings.page.format === 'A4' ? [210, 297] : [148, 210];
  return settings.page.orientation === 'landscape' ? [dimensions[1], dimensions[0]] : dimensions;
}
