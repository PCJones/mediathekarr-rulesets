import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError,map } from 'rxjs/operators';

export interface Media {
  id: number;
  name: string;
  type: string;
  tmdbId?: number | null;
  imdbId?: string;
  tvdbId?: number | null;
  coverUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private readonly API_URL = 'https://mediathekarr.pcjones.de/metadata/api/media.php';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Media[]> {
    return this.http.get<Media[]>(this.API_URL).pipe(
      catchError(error => {
        console.error('Error fetching media:', error);
        return throwError(() => new Error('Failed to fetch media'));
      })
    );
  }

  create(media: Partial<Media>): Observable<{ success: boolean; id: number }> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    const payload = JSON.stringify({
      name: media.name,
      type: media.type,
      tmdbId: media.tmdbId || null,
      imdbId: media.imdbId || '',
      tvdbId: media.tvdbId || null
    });

    return this.http.post<{ success: boolean; id: number }>(this.API_URL, payload, { headers }).pipe(
      catchError(error => {
        console.error('Create error:', error);
        return throwError(() => new Error('Failed to create media'));
      })
    );
  }

  update(id: number, media: Partial<Media>): Observable<{ success: boolean }> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    const payload = JSON.stringify({
      name: media.name,
      type: media.type,
      tmdbId: media.tmdbId || null,
      imdbId: media.imdbId || '',
      tvdbId: media.tvdbId || null
    });

    return this.http.put<{ success: boolean }>(`${this.API_URL}?id=${id}`, payload, { headers }).pipe(
      catchError(error => {
        console.error('Update error:', error);
        return throwError(() => new Error('Failed to update media'));
      })
    );
  }

  delete(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.API_URL}?id=${id}`).pipe(
      catchError(error => {
        console.error('Delete error:', error);
        return throwError(() => new Error('Failed to delete media'));
      })
    );
  }

  checkMediaExists(name: string): Observable<boolean> {
    return this.getAll().pipe(
      map(mediaList => mediaList.some(media => 
        media.name.toLowerCase().trim() === name.toLowerCase().trim()
      ))
    );
  }
}