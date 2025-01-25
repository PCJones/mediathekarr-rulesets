import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-json-editor',
  template: `
    <div class="mt-4">
      <label class="label font-medium">{{ label }}</label>
      <div class="relative">
        <textarea
          [value]="formatJson(data)"
          (input)="handleInput($event)"
          class="textarea bg-base-200/50 border-base-content/10 rounded-xl w-full h-48 font-mono text-sm"
          [class.error]="hasError"
        ></textarea>
        <div *ngIf="hasError" class="text-error text-sm mt-1">
          Ungültiges JSON Format
        </div>
      </div>
    </div>
  `
})
export class JsonEditorComponent {
  @Input() data: any;
  @Input() label: string = 'JSON Editor';
  @Output() dataChange = new EventEmitter<any>();
  
  hasError = false;

  formatJson(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  handleInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    try {
      const parsed = JSON.parse(textarea.value);
      this.hasError = false;
      this.dataChange.emit(parsed);
    } catch (e) {
      this.hasError = true;
    }
  }
}