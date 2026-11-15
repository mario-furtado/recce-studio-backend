import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { API_BASE_URL } from '../../services/api.config';
import { AuthService } from '../../services/auth.service';
import { PersonalAccountComponent } from './personal-account.component';

describe('FEAT-027 personal account deactivation', () => {
  it('shows the consequences, keeps the session on rejection and signs out after success', () => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['getToken', 'clearSession']);
    auth.getToken.and.returnValue('fixture-session');
    TestBed.configureTestingModule({
      imports: [PersonalAccountComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(PersonalAccountComponent);
    const http = TestBed.inject(HttpTestingController);
    const view = fixture.componentInstance;
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    http.expectOne(`${API_BASE_URL}/api/auth/me`).flush({
      email: 'owner@example.invalid', emailVerified: true, hasWorkspace: false, deactivationAvailable: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('details').textContent).toContain('Os leitores autorizados mantêm acesso');
    view.deactivate();
    http.expectNone(request => request.method === 'POST');
    view.password = 'fixture-password';
    view.deactivate();
    const failed = http.expectOne(`${API_BASE_URL}/api/auth/deactivate`);
    expect(failed.request.body).toEqual({ password: 'fixture-password' });
    expect(view.password).toBe('');
    failed.flush({ message: 'Password incorreta.' }, { status: 403, statusText: 'Forbidden' });
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(view.deactivationError).toBe('Password incorreta.');
    view.password = 'fixture-password';
    view.deactivate();
    http.expectOne(`${API_BASE_URL}/api/auth/deactivate`).flush(null, { status: 204, statusText: 'No Content' });
    expect(auth.clearSession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login']);
    fixture.destroy();
    http.verify();
  });
});
