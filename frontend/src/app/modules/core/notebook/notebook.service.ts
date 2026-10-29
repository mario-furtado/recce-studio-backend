import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { API_BASE_URL } from '../services/api.config';
import { defaultNotebook, NotebookSettings } from './notebook.model';

@Injectable({ providedIn: 'root' })
export class NotebookService {
  private readonly url = `${API_BASE_URL}/api/notebook-preferences`;
  constructor(private http: HttpClient) {}
  load() { return this.http.get<NotebookSettings | null>(this.url).pipe(map(value => {
    const settings = value ?? defaultNotebook();
    return { ...settings, page: { ...settings.page, alignment: settings.page.alignment === undefined ? 'center' as const : settings.page.alignment } };
  })); }
  save(settings: NotebookSettings) { return this.http.put<NotebookSettings>(this.url, settings); }
}
