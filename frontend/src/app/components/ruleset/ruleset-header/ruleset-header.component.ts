import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ruleset-header',
  templateUrl: './ruleset-header.component.html',
  styleUrls: []
})
export class RulesetHeaderComponent {
  @Input() mediaName!: string;
  @Input() tvdbId!: string;
}