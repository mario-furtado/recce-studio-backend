export interface CrewContext { id: string; name: string; }
const key = 'recce_crew_context';

// Tab-local selection bound to the exact login session; the server authorizes every request.
export function getCrewContext(): CrewContext | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    const token = localStorage.getItem('recce_auth_token');
    return token && token !== 'offline-session' && value?.token === token && typeof value.id === 'string' && value.id.length > 0 && typeof value.name === 'string'
      ? { id: value.id, name: value.name } : null;
  } catch { return null; }
}
export function setCrewContext(crew: CrewContext) {
  const token = localStorage.getItem('recce_auth_token');
  if (!token || token === 'offline-session') throw new Error('Inicia sessão para escolher uma tripulação.');
  sessionStorage.setItem(key, JSON.stringify({ ...crew, token }));
}
export function clearCrewContext() { sessionStorage.removeItem(key); }
export function hasStaleCrewContext(): boolean { return sessionStorage.getItem(key) !== null && getCrewContext() === null; }
