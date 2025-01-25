import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Ruleset {
  id?: number;
  mediaId: string;
  topic: string;
  priority: number;
  filters: any[];
  titleRegexRules: any[];
  episodeRegex?: string;
  seasonRegex?: string;
  matchingStrategy: string;
}

@Injectable({
  providedIn: 'root'
})
export class RulesetService {
  private readonly API_URL = 'https://mediathekarr.pcjones.de/metadata/api/rulesets.php';

  constructor(private http: HttpClient) {}

  getByMediaId(mediaId: string): Observable<Ruleset[]> {
    return this.http.get<Ruleset[]>(`${this.API_URL}?mediaId=${mediaId}`);
  }

  create(ruleset: Ruleset): Observable<{ success: boolean; id: number }> {
    return this.http.post<{ success: boolean; id: number }>(this.API_URL, ruleset);
  }

  update(ruleset: Ruleset): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(this.API_URL, ruleset);
  }

  delete(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.API_URL}/delete?id=${id}`);
  }
}