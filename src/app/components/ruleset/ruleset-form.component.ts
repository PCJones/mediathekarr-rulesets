import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Ruleset } from '../../services/ruleset.service';

@Component({
  selector: 'app-ruleset-form',
  templateUrl: './ruleset-form.component.html',
})
export class RulesetFormComponent {
  @Input() mediaName!: string;
  @Input() rulesetForm!: FormGroup;
  @Input() editingRuleset: Ruleset | null = null;
  @Input() predefinedRegexPatterns: any[] = [];
  @Input() predefinedSeasonEpisodePatterns: any[] = [];
  @Input() durationInfo: {
    averageRuntime: number;
    episodeCount: number;
    calculatedMin: number;
  } = {
    averageRuntime: 0,
    episodeCount: 0,
    calculatedMin: 0
  };

  @Output() formSubmit = new EventEmitter<void>();
  @Output() resetForm = new EventEmitter<void>();

  constructor(private fb: FormBuilder) {}

  get filters(): FormArray {
    return this.rulesetForm.get('filters') as FormArray;
  }

  get titleRegexRules(): FormArray {
    return this.rulesetForm.get('titleRegexRules') as FormArray;
  }

  addFilter(): void {
    this.filters.push(
      this.fb.group({
        attribute: ['channel', Validators.required],
        type: ['ExactMatch', Validators.required],
        value: ['', Validators.required],
      })
    );
  }

  removeFilter(index: number): void {
    this.filters.removeAt(index);
  }

  addTitleRegexRule(): void {
    this.titleRegexRules.push(
      this.fb.group({
        type: ['regex', Validators.required],
        field: ['title'],
        pattern: [''],
        value: [''],
      })
    );
  }

  removeTitleRegexRule(index: number): void {
    this.titleRegexRules.removeAt(index);
  }

  onSubmit(): void {
    if (this.rulesetForm.valid) {
      this.formSubmit.emit();
    }
  }

  reset(): void {
    this.resetForm.emit();
  }
  handleSeasonEpisodePatternChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const pattern = this.predefinedSeasonEpisodePatterns[Number(select.value)];
    if (pattern) {
      this.rulesetForm.patchValue({
        episodeRegex: pattern.episodePattern,
        seasonRegex: pattern.seasonPattern
      });
    }
  }
  
  handlePatternChange(event: Event, index: number): void {
    const select = event.target as HTMLSelectElement;
    const selectedValue = select.value;
    const rule = this.titleRegexRules.at(index);
    if (rule) {
      rule.patchValue({ pattern: selectedValue });
    }
  }

handleFiltersJsonUpdate(newData: any[]): void {
  this.filters.clear();
  newData.forEach(filter => {
    this.filters.push(this.fb.group({
      attribute: [filter.attribute || 'channel', Validators.required],
      type: [filter.type || 'ExactMatch', Validators.required],
      value: [filter.value || '', Validators.required],
    }));
  });
}

handleRegexRulesJsonUpdate(newData: any[]): void {
  this.titleRegexRules.clear();
  newData.forEach(rule => {
    this.titleRegexRules.push(this.fb.group({
      type: [rule.type || 'regex', Validators.required],
      field: [rule.field || 'title'],
      pattern: [rule.pattern || ''],
      value: [rule.value || ''],
    }));
  });
}

}