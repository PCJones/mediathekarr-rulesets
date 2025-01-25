import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ruleset-header',
  template: `
    <div class="bg-base-100 rounded-3xl border border-base-content/10 p-6 mb-8">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div class="flex items-center gap-4">
          <div class="w-2 h-12 bg-primary rounded-full"></div>
          <h1 class="text-2xl font-bold">
            Rulesets für 
            <a 
              [href]="'https://www.thetvdb.com/series/' + tvdbId + '-show#seasons'" 
              target="_blank" 
              class="text-primary hover:text-primary/80"
            >
              {{ mediaName }}
            </a>
          </h1>
        </div>
        
        <button 
          class="btn btn-ghost rounded-2xl px-6 w-full sm:w-auto" 
          routerLink="/media"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            class="h-5 w-5 mr-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M10 19l-7-7m0 0l7-7m-7 7h18" 
            />
          </svg>
          Zurück zur Übersicht
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      contain: content;
    }
    
    div {
      box-sizing: border-box;
      contain: paint layout;
    }
  `]
})
export class RulesetHeaderComponent {
  @Input() mediaName!: string;
  @Input() tvdbId?: number;
}