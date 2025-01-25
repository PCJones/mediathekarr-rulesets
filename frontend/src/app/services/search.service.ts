import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface SearchResult {
  status: string;
  germanTitle: string;
  originalTitle: string;
  tvdbId: number;
  aliases: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private baseUrl = 'https://umlautadaptarr.pcjones.de/api/v1/tvshow_german.php';

  constructor(private http: HttpClient) {}

  searchShow(title: string): Observable<SearchResult> {
    return this.http.get<SearchResult>(`${this.baseUrl}?title=${encodeURIComponent(title)}`);
  }
}