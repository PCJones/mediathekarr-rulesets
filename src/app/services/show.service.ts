import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

interface Episode {
  seasonNumber: number;
  aired: string;
  runtime: number;
}

interface DurationResult {
  averageRuntime: number;
  episodeCount: number;
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class ShowService {
  private readonly API_URL = 'https://mediathekarr.pcjones.de/api/v1/get_show.php';

  constructor(private http: HttpClient) {}

  getShowData(tvdbId: string): Observable<DurationResult> {
    return this.http.get<any>(`${this.API_URL}?tvdbid=${tvdbId}`).pipe(
      map(response => {
        const today = new Date();
        const episodes = response.data?.episodes || [];
        
        const filteredEpisodes = episodes
          .filter((ep: Episode) => 
            ep.seasonNumber > 0 && 
            ep.aired != null && 
            new Date(ep.aired) < today && 
            ep.runtime != null
          )
          .slice(0, 100);

        if (filteredEpisodes.length === 0) {
          return {
            averageRuntime: 0,
            episodeCount: 0,
            duration: 0
          };
        }

        const totalRuntime = filteredEpisodes.reduce((sum: number, ep: Episode) => 
          sum + ep.runtime, 0
        );

        const averageRuntime = Math.round(totalRuntime / filteredEpisodes.length);
        const duration = Math.round(averageRuntime * 0.7);

        console.log('Filtered Episodes Count:', filteredEpisodes.length);
        console.log('Average Runtime:', averageRuntime);
        console.log('Calculated Duration:', duration);

        return {
          averageRuntime: averageRuntime,
          episodeCount: filteredEpisodes.length,
          duration: duration
        };
      })
    );
}
}