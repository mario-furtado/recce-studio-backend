import { composeNote, defaultNotebook, displayRule, pageDimensions, settingsError } from './notebook.model';

describe('FEAT-004 personal note composition', () => {
  it('FEAT-009 defaults to center, accepts legacy pages and rejects invalid alignment values', () => {
    const settings = defaultNotebook();
    expect(settings.page.alignment).toBe('center');
    delete settings.page.alignment; expect(settingsError(settings)).toBeNull();
    for (const alignment of ['left', 'center', 'right']) {
      Object.assign(settings.page, { alignment }); expect(settingsError(settings)).toBeNull();
    }
    for (const alignment of [null, '', 'justify', 'url(javascript:alert(1))', 1]) {
      Object.assign(settings.page, { alignment }); expect(settingsError(settings)).toContain('Página inválida');
    }
  });
  it('attaches compact modifiers and warnings to their own main block', () => {
    const blocks = composeNote('E6++ nt D3-', defaultNotebook().rules);
    expect(blocks.length).toBe(2);
    expect(blocks[0].elements.map(item => item.display)).toEqual(['E6', '++', 'nt']);
    expect(blocks[0].elements.map(item => item.position)).toEqual(['center', 'top-right', 'bottom-right']);
    expect(blocks[1].elements.map(item => item.display)).toEqual(['D3', '-']);
  });
  it('preserves every item in a multi-block sequence and attaches a prefix warning forward', () => {
    const blocks = composeNote('D6 > E3 60 ATT E1 NC', defaultNotebook().rules);
    expect(blocks.map(block => block.elements.map(item => item.display))).toEqual([['D6'], ['>'], ['E3'], ['60'], ['ATT', 'E1', 'NC']]);
  });
  it('retains unknown Unicode, markup and unsupported shorthand literally', () => {
    const blocks = composeNote('Z10 ↗ <img/onerror=boom> E60', defaultNotebook().rules);
    expect(blocks.flatMap(block => block.elements.map(item => item.display))).toEqual(['Z10', '↗', '<img/onerror=boom>', 'E60']);
  });
  it('uses a literal longest match with configurable display and no universal symbol meaning', () => {
    const rules = [displayRule('>'), { ...displayRule('>>'), display: 'liga', meaning: 'my convention' }];
    expect(composeNote('>>', rules)[0].elements[0].display).toBe('liga');
    expect(composeNote('>>', rules)[0].elements[0].meaning).toBe('my convention');
  });
  it('keeps orphan modifiers visible and never attaches across explicit line breaks', () => {
    const blocks = composeNote('++ E6\nnt ATT', defaultNotebook().rules);
    expect(blocks.flatMap(block => block.elements.map(item => item.display))).toEqual(['++', 'E6', 'nt', 'ATT']);
    expect(blocks[2].breakBefore).toBeTrue();
  });
  it('supports standalone and next associations without changing the source text', () => {
    const settings = defaultNotebook();
    settings.rules.find(rule => rule.match === 'nt')!.attach = 'standalone';
    const text = 'E6 nt E3';
    expect(composeNote(text, settings.rules).map(block => block.elements.length)).toEqual([1, 1, 1]);
    expect(text).toBe('E6 nt E3');
  });
  it('validates page limits and duplicate rules while allowing an empty dictionary', () => {
    const settings = defaultNotebook();
    expect(settingsError(settings)).toBeNull();
    settings.rules.push({ ...settings.rules[0] }); expect(settingsError(settings)).toContain('Dicionário inválido');
    settings.rules = []; expect(settingsError(settings)).toBeNull();
    settings.page.rowsPerPage = 2.5; expect(settingsError(settings)).toContain('Página inválida');
  });
  it('does not mutate settings and supports both page sizes and orientations', () => {
    const settings = defaultNotebook(); const before = JSON.stringify(settings);
    composeNote('E6++ nt', settings.rules); expect(JSON.stringify(settings)).toBe(before);
    settings.page.format = 'A5'; expect(pageDimensions(settings)).toEqual([148, 210]);
    settings.page.orientation = 'landscape'; expect(pageDimensions(settings)).toEqual([210, 148]);
  });
});
