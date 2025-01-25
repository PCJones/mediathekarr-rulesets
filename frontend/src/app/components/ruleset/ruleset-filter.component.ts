import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, AbstractControl } from '@angular/forms';

interface FilterFormGroup {
  attribute: AbstractControl;
  type: AbstractControl;
  value: AbstractControl;
}

@Component({
  selector: 'app-ruleset-filter',
  template: `
    <div [formGroup]="formGroup" class="flex gap-3 p-4 bg-base-200/30 rounded-2xl">
      <select formControlName="attribute" class="select bg-base-200/50 border-base-content/10 rounded-xl flex-1">
        <option value="channel">Channel</option>
        <option value="topic">Topic</option>
        <option value="title">Title</option>
        <option value="description">Description</option>
        <option value="duration">Duration</option>
        <option value="size">Size</option>
      </select>
      
      <select formControlName="type" class="select bg-base-200/50 border-base-content/10 rounded-xl flex-1">
        <option value="ExactMatch">Exact Match</option>
        <option value="Contains">Contains</option>
        <option value="Regex">Regex</option>
        <option value="LowerThan">Lower Than</option>
        <option value="GreaterThan">Greater Than</option>
      </select>
      
      <input type="text" formControlName="value" class="input bg-base-200/50 border-base-content/10 rounded-xl flex-1" />
      
      <button 
        type="button" 
        class="btn btn-ghost btn-sm text-error rounded-xl" 
        (click)="remove.emit()"
        aria-label="Remove filter">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  `,
})
export class RulesetFilterComponent {
  @Input() formGroup!: FormGroup<FilterFormGroup>;
  @Output() remove = new EventEmitter<void>();
}