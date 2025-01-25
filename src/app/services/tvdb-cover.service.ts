// import { Injectable } from '@angular/core';
// import { HttpClient } from '@angular/common/http';

// interface TvdbImage {
//     coverType: string;
//     url: string;
//   }
  
//   interface TvdbResponse {
//     images: TvdbImage[];
//   }
  
//   @Injectable({
//     providedIn: 'root'
//   })
//   export class TvdbCoverService {
//     private readonly baseUrl = 'http://skyhook.sonarr.tv/v1/tvdb/shows/en';
  
//     constructor(private http: HttpClient) {}
  
//     async getCoverUrl(tvdbId: number): Promise<string> {
//       try {
//         const response = await this.http.get<TvdbResponse>(`${this.baseUrl}/${tvdbId}`).toPromise();
//         if (!response) {
//           return '';
//         }
//         // Suche nach dem Poster-Type und extrahiere die URL
//         const poster = response.images.find((img: TvdbImage) => img.coverType === 'Poster');
//         return poster?.url || '';
//       } catch (error) {
//         console.error('Fehler beim Laden des Covers:', error);
//         return '';
//       }
//     }
//   }