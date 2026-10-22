import { BehaviorSubject, Subject } from 'rxjs';
import { Router } from '@angular/router';
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
