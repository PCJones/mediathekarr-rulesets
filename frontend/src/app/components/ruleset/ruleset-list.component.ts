import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Ruleset } from '../../services/ruleset.service';

@Component({
  selector: 'app-ruleset-list',
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      <div *ngFor="let ruleset of rulesets" 
           class="bg-base-100 rounded-3xl shadow-lg border border-base-content/10 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
        <div class="p-4 border-b border-base-content/10">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-1.5 h-8 bg-primary rounded-full"></div>
              <h2 class="text-lg font-bold truncate">{{ ruleset.topic }}</h2>
            </div>
            <span class="badge badge-primary badge-lg rounded-xl">
              Priority: {{ ruleset.priority }}
            </span>
          </div>
        </div>

        <div class="p-4">
  <div class="flex flex-col sm:flex-row gap-2">
    <button class="btn btn-ghost btn-sm rounded-2xl flex-1 hover:bg-base-content/5 w-full sm:w-auto"
            (click)="duplicate.emit(ruleset)">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/>
      </svg>
      Duplizieren
    </button>
    <button class="btn btn-ghost btn-sm rounded-2xl flex-1 hover:bg-base-content/5 w-full sm:w-auto"
            (click)="editAndScroll(ruleset)">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
      </svg>
      Bearbeiten
    </button>
    <button class="btn btn-ghost btn-sm rounded-2xl text-error hover:bg-error/10 w-full sm:w-auto"
            (click)="delete.emit(ruleset)">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
      Löschen
    </button>
  </div>
</div>
        </div>
      </div>
  `
})
export class RulesetListComponent {
  @Input() rulesets: Ruleset[] = [];
  @Output() edit = new EventEmitter<Ruleset>();
  @Output() delete = new EventEmitter<Ruleset>();
  @Output() duplicate = new EventEmitter<Ruleset>();

  editAndScroll(ruleset: Ruleset): void {
    this.edit.emit(ruleset);
  
    setTimeout(() => {
      const editSection = document.querySelector('#editSection');
      if (editSection) {
        editSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }

}
