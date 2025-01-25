import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Ruleset } from '../../../services/ruleset.service';

@Component({
  selector: 'app-ruleset-list',
  templateUrl: './ruleset-list.component.html',
  styleUrls: []
})
export class RulesetListComponent {
  @Input() rulesets: Ruleset[] | undefined;
  @Output() edit = new EventEmitter<Ruleset>();
  @Output() delete = new EventEmitter<Ruleset>();
  @Output() duplicate = new EventEmitter<Ruleset>();

  onEdit(ruleset: Ruleset) {
    this.edit.emit(ruleset);
  }

  onDelete(ruleset: Ruleset) {
    this.delete.emit(ruleset);
  }

  onDuplicate(ruleset: Ruleset) {
    this.duplicate.emit(ruleset);
  }
}