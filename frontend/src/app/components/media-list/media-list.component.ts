import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MediaService, Media } from '../../services/media.service';
import { AuthService } from '../../services/auth.service';
import { SearchService } from '../../services/search.service';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
// import { TvdbCoverService } from '../../services/tvdb-cover.service';

interface SearchResult {
  germanTitle: string;
  originalTitle: string;
  tvdbId: number;
  aliases?: string[];
  posterUrl?: string;
  year?: number;
  coverUrl?: string; 
  
}

@Component({
  selector: 'app-media-list',
  templateUrl: './media-list.component.html',
  styleUrls: ['./media-list.component.scss']
})
export class MediaListComponent implements OnInit, OnDestroy {
  mediaList: Media[] = [];
  mediaForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    type: ['show', Validators.required],
    tmdbId: [null],
    imdbId: [''],
    tvdbId: [null]
  });
  showForm = false;
  editingMedia: Media | null = null;
  searchQuery: string = '';
  isSearching = false;
  searchResults: SearchResult[] = [];
  showDropdown = false;
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

    trackById(index: number, media: Media): number {
    return media.id;
  }

  trackByTvdbId(index: number, result: SearchResult): number {
    return result.tvdbId;
  }


  constructor(
    private mediaService: MediaService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private searchService: SearchService,
    // private tvdbCoverService: TvdbCoverService,
  ) {}

  ngOnInit(): void {
    this.loadMedia();
    this.setupClickOutsideListener();
    this.setupSearchSubscription();
    this.loadMediaCovers();
  }

  private setupSearchSubscription(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        if (query.length >= 2) {
          this.performSearch(query);
        } else {
          this.clearSearchResults();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMedia(): void {
    this.mediaService.getAll().subscribe({
      next: (media) => {
        this.mediaList = media;
        this.loadMediaCovers();  // Hier aufrufen nach dem die Liste geladen wurde
      },
      error: (error) => console.error('Error loading media:', error)
    });
  }

  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  private performSearch(query: string): void {
    this.isSearching = true;
    this.searchService.searchShow(query).subscribe({
      next: (results: SearchResult[] | SearchResult) => {
        this.searchResults = Array.isArray(results) ? results : [results];
        this.showDropdown = true;
        this.isSearching = false;
      },
      error: (error) => {
        console.error('Search error:', error);
        this.isSearching = false;
      }
    });
  }

  selectResult(result: SearchResult): void {
    this.mediaForm.patchValue({
      name: result.germanTitle,
      type: 'show',
      tvdbId: result.tvdbId
    });
    this.closeDropdown();
    this.showForm = true;
  }

  private clearSearchResults(): void {
    this.searchResults = [];
    this.showDropdown = false;
  }

  closeDropdown(): void {
    this.showDropdown = false;
    this.searchResults = [];
    this.searchQuery = '';
  }

  private setupClickOutsideListener(): void {
    document.addEventListener('click', (event: MouseEvent) => {
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer && !searchContainer.contains(event.target as Node)) {
        this.closeDropdown();
      }
    });
  }

  showAddForm(): void {
    this.editingMedia = null;
    this.mediaForm.reset({ type: 'show' });
    this.showForm = true;
  }

  editMedia(media: Media): void {
    this.editingMedia = media;
    this.mediaForm.patchValue(media);
    this.showForm = true;
  }

  cancelEdit(): void {
    this.showForm = false;
    this.editingMedia = null;
    this.mediaForm.reset({ type: 'show' });
  }

  onSubmit(): void {
    if (this.mediaForm.valid) {
      const mediaData = this.mediaForm.value;
      
      if (this.editingMedia) {
        this.updateMedia(mediaData);
        return;
      }
  
      this.mediaService.checkMediaExists(mediaData.name).subscribe({
        next: (exists) => {
          if (exists) {
            this.mediaForm.get('name')?.setErrors({
              mediaExists: 'Dieses Medium existiert bereits in der Datenbank'
            });
          } else {
            this.createMedia(mediaData);
          }
        },
        error: (error) => console.error('Fehler beim Prüfen des Mediums:', error)
      });
    }
  }
  
  private createMedia(mediaData: Partial<Media>): void {
    this.mediaService.create(mediaData).subscribe({
      next: () => {
        this.loadMedia();  // Dies wird jetzt auch loadMediaCovers aufrufen
        this.cancelEdit();
      },
      error: (error) => console.error('Fehler beim Erstellen des Mediums:', error)
    });
  }
  
  private updateMedia(mediaData: Partial<Media>): void {
    this.mediaService.update(this.editingMedia!.id, mediaData).subscribe({
      next: () => {
        this.loadMedia();  // Dies wird jetzt auch loadMediaCovers aufrufen
        this.cancelEdit();
      },
      error: (error) => console.error('Fehler beim Aktualisieren des Mediums:', error)
    });
  }

  deleteMedia(media: Media): void {
    if (confirm(`Are you sure you want to delete ${media.name}?`)) {
      this.mediaService.delete(media.id).subscribe({
        next: () => this.loadMedia(),
        error: (error) => console.error('Error deleting media:', error)
      });
    }
  }

  

  viewRulesets(media: Media): void {
    this.router.navigate(['/rulesets', media.id]).then(() => {
      window.scrollTo(0, 0);
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  async loadMediaCovers() {
    console.log('Media List:', this.mediaList);
    
    for (const media of this.mediaList) {
      if (media.tvdbId) {
        try {
          // media.coverUrl = await this.tvdbCoverService.getCoverUrl(media.tvdbId);
          console.log('Cover URL loaded:', media.coverUrl);
        } catch (error) {
          console.error('Fehler beim Laden des Covers:', error);
        }
      }
    }
  }


}