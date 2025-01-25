import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-regex-rule',
  template: `
    <div [formGroup]="formGroup" class="flex flex-col gap-3 p-4 bg-base-200/30 rounded-2xl">
      <div class="flex gap-3">
        <select formControlName="type" class="select bg-base-200/50 border-base-content/10 rounded-xl flex-1">
          <option value="regex">Regex</option>
          <option value="static">Statischer Text</option>
        </select>

        <ng-container *ngIf="formGroup.get('type')?.value === 'regex'">
          <select formControlName="field" class="select bg-base-200/50 border-base-content/10 rounded-xl flex-1">
            <option value="title">Title</option>
            <option value="description">Beschreibung</option>
          </select>
          <input type="text" formControlName="pattern" class="input bg-base-200/50 border-base-content/10 rounded-xl flex-1" placeholder="Pattern" />
        </ng-container>

        <input *ngIf="formGroup.get('type')?.value === 'static'" type="text" formControlName="value" class="input bg-base-200/50 border-base-content/10 rounded-xl flex-1" placeholder="Static Text" />

        <button type="button" class="btn btn-ghost btn-sm text-error rounded-xl" (click)="remove.emit()">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div *ngIf="formGroup.get('type')?.value === 'regex'" class="mt-2">
        <select class="select select-sm bg-base-200/50 w-full" (change)="handlePatternChange($event)">
          <option value="">Wähle Vorlage</option>
          <option *ngFor="let pattern of predefinedRegexPatterns" [value]="pattern.value">
            {{ pattern.name }}
          </option>
        </select>
      </div>
    </div>
  `,
})
export class RegexRuleComponent {
  @Input() formGroup!: FormGroup;
  @Input() predefinedRegexPatterns: { name: string; value: string }[] = [];
  @Output() remove = new EventEmitter<void>();

  handlePatternChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const selectedValue = select?.value || '';
    if (selectedValue) {
      this.formGroup.patchValue({
        pattern: selectedValue
      });
    }
  }
}