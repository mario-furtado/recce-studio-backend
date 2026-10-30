export interface CoverText {
  text: string; x: number; y: number; width: number; fontPt: number;
  font: 'Arial' | 'Georgia' | 'Courier New'; align: 'left' | 'center' | 'right';
  bold: boolean; italic: boolean; underline: boolean; color: string;
}
export interface CoverSide { background: string; elements: CoverText[] }
export interface BookCover { version: 1; front: CoverSide; back: CoverSide }
export function coverText(text = 'Novo texto'): CoverText {
  return { text, x: 0, y: 0, width: 100, fontPt: 16, font: 'Arial', align: 'center', bold: false, italic: false, underline: false, color: '#000000' };
}
export function defaultBookCover(): BookCover {
  return { version: 1, front: { background: '#ffffff', elements: [{ ...coverText('RecceBook'), fontPt: 24, bold: true }] }, back: { background: '#ffffff', elements: [] } };
}
export function coverError(value: BookCover): string | null {
  const bad = 'Capa inválida. Verifica textos, posições, tamanhos e cores; a marca não é editável.';
  const keys = (v: unknown, allowed: string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(key => allowed.includes(key));
  const color = (v: unknown) => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v);
  const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (!keys(value, ['version', 'front', 'back']) || value.version !== 1) return bad;
  for (const page of [value.front, value.back]) {
    if (!keys(page, ['background', 'elements']) || !color(page.background) || !Array.isArray(page.elements) || page.elements.length > 12) return bad;
    for (const e of page.elements) {
      if (!keys(e, ['text', 'x', 'y', 'width', 'fontPt', 'font', 'align', 'bold', 'italic', 'underline', 'color'])
        || typeof e.text !== 'string' || e.text.length > 1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(e.text)
        || !num(e.x, 0, 95) || !num(e.y, 0, 95) || !num(e.width, 5, 100) || e.x + e.width > 100 || !num(e.fontPt, 8, 72)
        || !['Arial', 'Georgia', 'Courier New'].includes(e.font) || !['left', 'center', 'right'].includes(e.align)
        || !['bold', 'italic', 'underline'].every(key => typeof e[key as keyof CoverText] === 'boolean') || !color(e.color)) return bad;
    }
  }
  return JSON.stringify(value).length <= 50000 ? null : bad;
}
