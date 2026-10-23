import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { AppAccentTheme, AppShellTheme, SharedProperties } from '../../core/shared/shared-properties';
import { SettingsComponent } from './settings.component';

describe('AUD-UI-001 selectable accent themes', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let shared: SharedProperties;
  let stored: Map<string, string | null>;
  let attributes: Map<string, string | null>;
  const palette: Record<AppAccentTheme, string> = {
    'racing-red': '#e31837', 'midnight-blue': '#1e90ff', 'forest-green': '#20b77a',
  };

  beforeEach(() => {
    stored = new Map(['recce_theme', 'recce_accent_theme', 'recce_shell_theme']
      .map((key) => [key, localStorage.getItem(key)]));
    attributes = new Map(['data-theme', 'data-accent-theme', 'data-shell-theme']
      .map((key) => [key, document.documentElement.getAttribute(key)]));
    localStorage.setItem('recce_accent_theme', 'racing-red');
    localStorage.setItem('recce_shell_theme', 'dark-blue');
    TestBed.configureTestingModule({ imports: [SettingsComponent] });
    shared = TestBed.inject(SharedProperties);
    fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    stored.forEach((value, key) => {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    });
    attributes.forEach((value, key) => {
      if (value === null) document.documentElement.removeAttribute(key);
      else document.documentElement.setAttribute(key, value);
    });
  });

  for (const shell of ['dark-blue', 'light'] as AppShellTheme[]) {
    for (const theme of Object.keys(palette) as AppAccentTheme[]) {
      it(`applies and restores the displayed ${theme} button in ${shell} mode before reporting success`, fakeAsync(() => {
        shared.setShellTheme(shell);
        const button: HTMLButtonElement = fixture.nativeElement.querySelector(`[data-preview-theme="${theme}"]`);
        expect(button).not.toBeNull();
        button.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.selectedAccentTheme).toBe(theme);
        expect(shared.accentTheme$.value).toBe(theme);
        expect(localStorage.getItem('recce_accent_theme')).toBe(theme);
        expect(localStorage.getItem('recce_theme')).toBe(theme);
        expect(document.documentElement.dataset['accentTheme']).toBe(theme);
        expect(document.documentElement.dataset['theme']).toBe(theme);
        expect(document.documentElement.dataset['shellTheme']).toBe(shell);
        expect(button.classList.contains('selected-ring')).toBeTrue();
        expect(fixture.nativeElement.querySelectorAll('[data-preview-theme].selected-ring').length).toBe(1);
        expect(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()).toBe(palette[theme]);
        expect(shared.toasts$.value.some((toast) => toast.type === 'success' && toast.title === 'Detalhe atualizado')).toBeTrue();
        const restarted = new SharedProperties();
        expect(new SettingsComponent(restarted).selectedAccentTheme).toBe(theme);
        expect(restarted.accentTheme$.value).toBe(theme);
        expect(document.documentElement.dataset['accentTheme']).toBe(theme);
        expect(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()).toBe(palette[theme]);
        tick(4000);
      }));
    }
  }

  it('falls back safely for missing and invalid stored accents without announcing success', () => {
    for (const value of [null, '', 'unknown', '__proto__', 'FOREST-GREEN']) {
      if (value === null) localStorage.removeItem('recce_accent_theme');
      else localStorage.setItem('recce_accent_theme', value);
      const restarted = new SharedProperties();
      expect(restarted.accentTheme$.value).toBe('racing-red');
      expect(new SettingsComponent(restarted).selectedAccentTheme).toBe('racing-red');
      expect(document.documentElement.dataset['accentTheme']).toBe('racing-red');
      expect(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()).toBe(palette['racing-red']);
      expect(restarted.toasts$.value).toEqual([]);
    }
  });

  it('keeps the legacy setter and observable alias compatible with all displayed options', fakeAsync(() => {
    expect(shared.theme$).toBe(shared.accentTheme$);
    for (const option of fixture.componentInstance.accentThemes) {
      shared.setTheme(option.value);
      expect(shared.theme$.value).toBe(option.value);
      expect(localStorage.getItem('recce_theme')).toBe(option.value);
      expect(new SharedProperties().accentTheme$.value).toBe(option.value);
    }
    tick(4000);
  }));
});
