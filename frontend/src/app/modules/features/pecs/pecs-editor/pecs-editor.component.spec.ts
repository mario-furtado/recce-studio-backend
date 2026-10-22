import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { API_BASE_URL } from '../../../core/services/api.config';
import { OfflineRecceStoreService } from '../../../core/services/offline-recce-store.service';
import { PecService } from '../../../core/services/pecs.service';
import { SharedProperties } from '../../../core/shared/shared-properties';
import { ConfirmDialogService } from '../../../core/shared/components/confirm-dialog/confirm-dialog.service';
import { PecsEditorComponent } from './pecs-editor.component';

describe('AUD-SEC-001 authenticated media playback', () => {
  let component: PecsEditorComponent;
  let http: HttpTestingController;
  let previousToken: string | null;

  beforeEach(() => {
    previousToken = localStorage.getItem('recce_auth_token');
    localStorage.setItem('recce_auth_token', 'owner-token');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    const service = TestBed.inject(PecService);
    spyOn(service, 'getGpsTrack').and.returnValue(of([]));
    spyOn(service, 'getPecRecceMarkers').and.returnValue(of([]));
    component = new PecsEditorComponent(
      {} as ActivatedRoute, service, {} as OfflineRecceStoreService,
      {} as SharedProperties, {} as ConfirmDialogService,
    );
    component.pecId = 'owned-pec';
    http = TestBed.inject(HttpTestingController);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:owned-video');
    spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => {
    component.ngOnDestroy();
    http.verify();
    if (previousToken === null) localStorage.removeItem('recce_auth_token');
    else localStorage.setItem('recce_auth_token', previousToken);
  });

  it('loads video through authenticated HTTP and releases the blob on replacement', () => {
    component.applyAssets({ hasVideo: true, hasAudio: false, hasGps: false });
    const request = http.expectOne(`${API_BASE_URL}/api/pecs/owned-pec/video`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['video'], { type: 'video/webm' }));
    expect(component.videoSrc).toBe('blob:owned-video');
    component.applyAssets({ hasVideo: false, hasAudio: false, hasGps: false });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:owned-video');
    expect(component.videoSrc).toBe('');
  });

  it('cancels a pending video download when the editor is destroyed', () => {
    component.applyAssets({ hasVideo: true, hasAudio: false, hasGps: false });
    const request = http.expectOne(`${API_BASE_URL}/api/pecs/owned-pec/video`);
    component.ngOnDestroy();
    expect(request.cancelled).toBeTrue();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('keeps audio playback authenticated', () => {
    component.applyAssets({ hasVideo: false, hasAudio: true, hasGps: false });
    const request = http.expectOne(`${API_BASE_URL}/api/pecs/owned-pec/audio`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['audio'], { type: 'audio/webm' }));
    expect(component.audioSrc).toBe('blob:owned-video');
  });

  it('does not expose a media source after access is denied', () => {
    spyOn(console, 'error');
    component.applyAssets({ hasVideo: true, hasAudio: false, hasGps: false });
    http.expectOne(`${API_BASE_URL}/api/pecs/owned-pec/video`)
      .flush(new Blob(['Forbidden']), { status: 404, statusText: 'Not Found' });
    expect(component.videoSrc).toBe('');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
