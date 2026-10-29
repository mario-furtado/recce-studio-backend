import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { OfflineRecceStoreService } from '../../services/offline-recce-store.service';
import { SharedProperties } from '../../shared/shared-properties';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('FEAT-002 login destinations', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let store: jasmine.SpyObj<OfflineRecceStoreService>;
  let router: jasmine.SpyObj<Router>;
  let shared: SharedProperties;

  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'isOfflineSession', 'enterOffline', 'login']);
    auth.isAuthenticated.and.returnValue(false);
    auth.isOfflineSession.and.returnValue(false);
    auth.login.and.returnValue(of({ token: 'online-token', email: 'owner@example.test' }));
    store = jasmine.createSpyObj('OfflineRecceStoreService', ['listSessions']);
    store.listSessions.and.resolveTo([]);
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    const mode = new BehaviorSubject('online');
    shared = {
      connectionMode$: mode,
      setConnectionMode: jasmine.createSpy('setConnectionMode').and.callFake((value: string) => mode.next(value)),
    } as unknown as SharedProperties;
  });

  it('opens the offline list on explicit offline entry', () => {
    new LoginComponent(auth, store, router, shared).enterOffline();
    expect(auth.enterOffline).toHaveBeenCalled();
    expect(shared.connectionMode$.value).toBe('offline');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/offline-recces']);
  });

  it('opens the offline list when submitting without a network', () => {
    const component = new LoginComponent(auth, store, router, shared);
    component.isBrowserOffline = true;
    component.submit();
    expect(auth.login).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/offline-recces']);
  });

  for (const storage of ['empty', 'pending', 'unavailable']) {
    it(`resumes offline at the list without depending on ${storage} storage`, fakeAsync(() => {
      auth.isAuthenticated.and.returnValue(true);
      auth.isOfflineSession.and.returnValue(true);
      // A hanging/rejected storage read must not decide the offline landing page.
      if (storage === 'unavailable') store.listSessions.and.callFake(() => { throw new Error('IndexedDB unavailable'); });
      if (storage === 'pending') store.listSessions.and.resolveTo([{ status: 'draft' }] as Awaited<ReturnType<OfflineRecceStoreService['listSessions']>>);
      new LoginComponent(auth, store, router, shared);
      flushMicrotasks();
      expect(shared.connectionMode$.value).toBe('offline');
      expect(router.navigate).toHaveBeenCalledOnceWith(['/offline-recces']);
      expect(store.listSessions).not.toHaveBeenCalled();
    }));
  }

  for (const storage of ['empty', 'pending', 'unavailable']) {
    it(`preserves the online login destination with ${storage} storage`, fakeAsync(() => {
      if (storage === 'unavailable') store.listSessions.and.rejectWith(new Error('IndexedDB unavailable'));
      if (storage === 'pending') store.listSessions.and.resolveTo([{ status: 'draft' }] as Awaited<ReturnType<OfflineRecceStoreService['listSessions']>>);
      const component = new LoginComponent(auth, store, router, shared);
      component.isBrowserOffline = false;
      component.form.email = 'owner@example.test';
      component.form.password = 'fixture-password';
      component.submit();
      flushMicrotasks();
      expect(auth.login).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledOnceWith([storage === 'pending' ? '/offline-recces' : '/']);
    }));
  }
});
