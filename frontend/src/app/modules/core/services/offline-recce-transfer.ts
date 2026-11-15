import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { OfflineDestination, OfflineRecceSession, OfflineRecceStoreService } from './offline-recce-store.service';
import { OfflineRecceSyncResponse, PecService } from './pecs.service';

export async function sendOfflineNotes(
  store: OfflineRecceStoreService, api: PecService, session: OfflineRecceSession,
  target: OfflineDestination, token: string,
): Promise<OfflineRecceSyncResponse> {
  store.requireSyncContext(session, token);
  const receipt = await firstValueFrom(api.syncOfflineRecce({
    sessionId: session.id, accountId: session.ownerAccountId!, crewId: session.crewId!,
    deviceId: session.deviceId, userEmail: session.userEmail, temporaryName: session.temporaryName,
    ...target, createdAt: session.createdAt, finishedAt: session.finishedAt,
    notesCount: session.notesCount, durationSeconds: session.durationSeconds,
    markers: session.markers, gpsTrack: session.gpsTrack,
  }).pipe(timeout(45_000)));
  store.requireSyncContext(session, token);
  if (!receipt.syncId || !receipt.pecId || receipt.offlineSessionId !== session.id
      || (target.pecId && receipt.pecId !== target.pecId)) {
    throw new Error('O recibo não corresponde ao destino da sessão.');
  }
  await store.rememberReceipt(session, token, receipt.syncId);
  return receipt;
}

export async function sendOfflineAudio(
  store: OfflineRecceStoreService, api: PecService, session: OfflineRecceSession,
  receipt: OfflineRecceSyncResponse, token: string,
): Promise<boolean> {
  store.requireSyncContext(session, token);
  if (!session.audioBlobId) return true;
  const audio = await store.getAudioBlob(session.audioBlobId);
  store.requireSyncContext(session, token);
  if (!audio) return false;
  const mime = (session.audioMimeType || audio.type).toLowerCase();
  const extension = mime.includes('mp4') || mime.includes('aac') ? 'm4a'
    : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3'
    : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
  try {
    await firstValueFrom(api.uploadAudio(receipt.pecId, audio, 'recce-audio.' + extension, {
      id: receipt.syncId, accountId: session.ownerAccountId!, crewId: session.crewId!,
    }).pipe(timeout(45_000)));
  } catch (error) {
    if (error instanceof HttpErrorResponse && [401, 403, 404, 409].includes(error.status)) throw error;
    return false;
  }
  store.requireSyncContext(session, token);
  return true;
}

export function offlineTransferError(error: unknown): string {
  if (error instanceof HttpErrorResponse && [401, 403, 404, 409].includes(error.status)) {
    return typeof error.error?.message === 'string'
      ? error.error.message : 'O destino ou a sessão de autenticação já não está disponível.';
  }
  return error instanceof Error && error.message.startsWith('Volta à conta')
    ? error.message : 'Falha ao enviar para o backend.';
}
