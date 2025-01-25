import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RulesetService, Ruleset } from '../../services/ruleset.service';
import { MediaService } from '../../services/media.service';
import { ShowService } from '../../services/show.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface Filter {
  attribute: string;
  type: string;
  value: string;
}

interface DurationResult {
  averageRuntime: number;
  episodeCount: number;
  duration: number;
}

interface RegexRule {
  type: string;
  field?: string;
  pattern?: string;
  value?: string;
}

@Component({
  selector: 'app-ruleset',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ruleset.component.html',
})
export class RulesetComponent implements OnInit {
  mediaId!: string;
  mediaName = '';
  rulesets: Ruleset[] = [];
  rulesetForm!: FormGroup;
  editingRuleset: Ruleset | null = null;
  tvdbId?: number; 

  readonly predefinedRegexPatterns = [
    { name: 'Default', value: '(.*)' },
    { name: 'Folge 1: Titel (S01/E01)', value: '^(?:Folge \\d+: )(.+?)(?: \\(\\S+\\))?$' },
    { name: 'Folge 1: Titel', value: '^Folge \\d+: (.+)$' },
    { name: 'Titel (S01/E01)', value: '^(.+?) \\(\\S+\\)$' },
  ];

  readonly predefinedSeasonEpisodePatterns = [
    {
      name: '(S01E01)',
      episodePattern: '(?<=\\bS\\d{2,4}\\s*/E)(\\d{2,4})(?=\\))',
      seasonPattern: '(?<=S)(\\d{2,4})(?=\\s*/E\\d{2,4})',
    },
    {
      name: 'Prinzessin (Staffel 4, Folge 4)',
      episodePattern: '(?<=Folge\\s)(\\d{1,4})(?=\\))',
      seasonPattern: '(?<=Staffel\\s)(\\d{1,4})(?=, Folge\\s\\d{1,4})',
    },
  ];

  private formSubscription: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rulesetService: RulesetService,
    private mediaService: MediaService,
    private showService: ShowService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.rulesetForm = this.fb.group({
      topic: ['', Validators.required],
      priority: [0, Validators.required],
      filters: this.fb.array([]),
      titleRegexRules: this.fb.array([]),
      episodeRegex: [''],
      seasonRegex: [''],
      matchingStrategy: ['SeasonAndEpisodeNumber', Validators.required],
    });

    this.formSubscription = this.rulesetForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  private durationInfo = {
    averageRuntime: 0,
    episodeCount: 0,
    calculatedMin: 0
  };
  
  private initializeDurationFilter(): void {
    if (this.filters.length === 0) {
      this.mediaService.getAll().subscribe({
        next: (mediaList) => {
          const media = mediaList.find((m) => m.id.toString() === this.mediaId);
          console.log('Found media:', media);

          if (media?.tvdbId) {
            this.showService.getShowData(media.tvdbId.toString()).subscribe({
              next: (result) => {
                console.log('API result:', result);
                
                this.durationInfo = {
                  averageRuntime: result.averageRuntime,
                  episodeCount: result.episodeCount,
                  calculatedMin: result.duration
                };
                
                console.log('Duration info:', this.durationInfo);

                const filterGroup = this.fb.group({
                  attribute: ['duration', Validators.required],
                  type: ['GreaterThan', Validators.required],
                  value: [result.duration.toString(), Validators.required],
                });
                this.filters.push(filterGroup);
                this.cdr.markForCheck();
              },
              error: (error) => console.error('Error getting show data:', error)
            });
          }
        },
        error: (error) => console.error('Error loading media:', error)
      });
    }
}

  ngOnInit(): void {
    this.mediaId = this.route.snapshot.params['mediaId'];
    this.loadRulesets();
    this.loadMediaName();
    if (!this.editingRuleset) {
      this.initializeDurationFilter();
    }
  }
  
  private loadMediaName(): void {
    this.mediaService.getAll().subscribe({
      next: (mediaList) => {
        const media = mediaList.find((m) => m.id.toString() === this.mediaId);
        if (media && media.tvdbId) {  
          this.mediaName = media.name;
          this.tvdbId = media.tvdbId; 
          this.cdr.markForCheck();
        }
      },
      error: (error) => console.error('Error loading media name:', error)
    });
  
  }
  private loadRulesets(): void {
    this.rulesetService.getByMediaId(this.mediaId).subscribe({
      next: (rulesets) => {
        this.rulesets = rulesets;
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading rulesets:', error),
    });
  }
  
    get filters(): FormArray {
    return this.rulesetForm.get('filters') as FormArray;
  }

  get titleRegexRules(): FormArray {
    return this.rulesetForm.get('titleRegexRules') as FormArray;
  }

  resetForm(): void {
    this.editingRuleset = null;
    this.initializeForm();
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.rulesetForm.valid) {
      const rulesetData: Ruleset = {
        ...this.rulesetForm.value,
        mediaId: this.mediaId,
        id: this.editingRuleset?.id
      };

      const operation = this.editingRuleset
        ? this.rulesetService.update(rulesetData)
        : this.rulesetService.create(rulesetData);

      operation.subscribe({
        next: () => {
          this.loadRulesets();
          this.resetForm();
        },
        error: (error) => console.error('Error saving ruleset:', error),
      });
    }
  }

  editRuleset(ruleset: Ruleset): void {
    this.editingRuleset = ruleset;
    
    this.filters.clear();
    this.titleRegexRules.clear();

    this.rulesetForm.patchValue({
      topic: ruleset.topic || '',
      priority: ruleset.priority ?? 0,
      episodeRegex: ruleset.episodeRegex || '',
      seasonRegex: ruleset.seasonRegex || '',
      matchingStrategy: ruleset.matchingStrategy || 'SeasonAndEpisodeNumber',
    });

    try {
      const parsedFilters = typeof ruleset.filters === 'string' 
        ? JSON.parse(ruleset.filters) 
        : ruleset.filters || [];

      const filtersArray = Array.isArray(parsedFilters)
        ? parsedFilters
        : [parsedFilters];

      filtersArray.forEach((filter: Filter) => {
        if (filter && typeof filter === 'object') {
          const filterGroup = this.fb.group({
            attribute: [filter.attribute || 'channel', Validators.required],
            type: [filter.type || 'ExactMatch', Validators.required],
            value: [filter.value || '', Validators.required],
          });
          this.filters.push(filterGroup);
        }
      });
    } catch (error) {
      console.error('Error parsing filters:', error);
    }

    try {
      const parsedRegexRules = typeof ruleset.titleRegexRules === 'string'
        ? JSON.parse(ruleset.titleRegexRules)
        : ruleset.titleRegexRules || [];

      const regexRulesArray = Array.isArray(parsedRegexRules)
        ? parsedRegexRules
        : [parsedRegexRules];

      regexRulesArray.forEach((rule: RegexRule) => {
        if (rule && typeof rule === 'object') {
          const ruleGroup = this.fb.group({
            type: [rule.type || 'regex', Validators.required],
            field: [rule.field || 'title'],
            pattern: [rule.pattern || ''],
            value: [rule.value || ''],
          });
          this.titleRegexRules.push(ruleGroup);
        }
      });
    } catch (error) {
      console.error('Error parsing regex rules:', error);
    }

    this.cdr.markForCheck();
  }

  deleteRuleset(ruleset: Ruleset): void {
    if (ruleset.id && confirm('Sind Sie sicher, dass Sie dieses Ruleset löschen möchten?')) {
      this.rulesetService.delete(ruleset.id).subscribe({
        next: () => this.loadRulesets(),
        error: (error) => console.error('Error deleting ruleset:', error),
      });
    }
  }

  duplicateRuleset(ruleset: Ruleset): void {
    try {
      const maxPriority = Math.max(...this.rulesets.map(r => r.priority || 0));
      
      const filters = typeof ruleset.filters === 'string' 
        ? JSON.parse(ruleset.filters) 
        : ruleset.filters;
      
      const titleRegexRules = typeof ruleset.titleRegexRules === 'string'
        ? JSON.parse(ruleset.titleRegexRules)
        : ruleset.titleRegexRules;

      const duplicatedRuleset = {
        ...ruleset,
        priority: maxPriority + 1, 
        topic: `${ruleset.topic || ''}`,
        filters: filters,
        titleRegexRules: titleRegexRules,
        episodeRegex: ruleset.episodeRegex,
        seasonRegex: ruleset.seasonRegex,
        matchingStrategy: ruleset.matchingStrategy
      };
      
      delete duplicatedRuleset.id;

      this.rulesetService.create(duplicatedRuleset).subscribe({
        next: () => this.loadRulesets(),
        error: (error) => console.error('Error duplicating ruleset:', error),
      });
    } catch (error) {
      console.error('Error parsing ruleset data for duplication:', error);
    }
}

  ngOnDestroy(): void {
    if (this.formSubscription) {
      this.formSubscription.unsubscribe();
    }
  }
}