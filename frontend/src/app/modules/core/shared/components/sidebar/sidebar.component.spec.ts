import { BehaviorSubject, Subject } from 'rxjs';
import { Router, provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../services/auth.service';
import { SharedProperties } from '../../shared-properties';
import { SidebarComponent } from './sidebar.component';

describe('AUD-SEC-006 online switch validation race', () => {
  for (const changed of [false, true]) {
    it(`does not revoke a newer login after an old validation fails (new login: ${changed})`, () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(true);
      let token = 'old-token';
      const validation = new Subject<void>();
      const logout = jasmine.createSpy('logout');
      const error = jasmine.createSpy('error');
      const auth = {
        isOfflineSession: () => false, getToken: () => token,
        validate: () => validation, logout,
      } as unknown as AuthService;
      const shared = {
        connectionMode$: new BehaviorSubject('offline'), info: jasmine.createSpy('info'), error,
      } as unknown as SharedProperties;
      const component = new SidebarComponent(auth, {} as Router, shared);
      component.toggleConnectionMode();
      if (changed) token = 'new-token';
      validation.error({ status: 401 });
      expect(component.isSwitchingConnectionMode).toBeFalse();
      if (changed) {
        expect(logout).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
      } else {
        expect(logout).toHaveBeenCalled();
        expect(error).toHaveBeenCalled();
      }
    });
  }
});

describe('FEAT-002 offline sidebar navigation', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let shared: SharedProperties;
  let router: Router;

  beforeEach(async () => {
    const mode = new BehaviorSubject('offline');
    shared = {
      connectionMode$: mode,
      setConnectionMode: jasmine.createSpy('setConnectionMode').and.callFake((value: string) => mode.next(value)),
    } as unknown as SharedProperties;
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: SharedProperties, useValue: shared }],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentInstance.isCollapsed = false;
    fixture.detectChanges();
  });

  it('disables Notes semantically and removes its navigation target offline, including collapsed mode', () => {
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    for (const collapsed of [false, true]) {
      fixture.componentInstance.isCollapsed = collapsed;
      fixture.detectChanges();
      const notes: HTMLAnchorElement = fixture.nativeElement.querySelector('a[aria-label="Notas"]');
      expect(notes).withContext('Notes must remain present').not.toBeNull();
      if (!notes) continue;
      expect(notes.classList).toContain('offline-disabled');
      expect(notes.getAttribute('aria-disabled')).toBe('true');
      expect(notes.getAttribute('role')).toBe('link');
      expect(notes.getAttribute('href')).toBeNull();
      expect(notes.tabIndex).toBe(-1);
      notes.click();
    }
    expect(navigate).not.toHaveBeenCalled();
  });

  it('restores Notes online and disables it again when changing back to offline', () => {
    shared.setConnectionMode('online');
    fixture.detectChanges();
    const notes: HTMLAnchorElement = fixture.nativeElement.querySelector('a[aria-label="Notas"]');
    expect(notes).not.toBeNull();
    if (!notes) return;
    expect(notes.getAttribute('href')).toBe('/notes');
    expect(notes.getAttribute('aria-disabled')).toBeNull();
    expect(notes.tabIndex).toBe(0);
    expect(notes.classList).not.toContain('offline-disabled');
    shared.setConnectionMode('offline');
    fixture.detectChanges();
    expect(notes.getAttribute('href')).toBeNull();
    expect(notes.getAttribute('aria-disabled')).toBe('true');
  });

  it('opens the offline list when switching from online mode', () => {
    shared.setConnectionMode('online');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.toggleConnectionMode();
    expect(shared.connectionMode$.value).toBe('offline');
    expect(navigate).toHaveBeenCalledOnceWith(['/offline-recces']);
  });
});
