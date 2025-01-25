import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="min-h-screen bg-base-100 text-base-content">
      <app-theme-toggle class="fixed top-6 right-6"></app-theme-toggle>
      <div class="w-full"> 
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      contain: content;
    }

    div {
      box-sizing: border-box;
      contain: paint layout;
    }
  `]
})
export class AppComponent {}