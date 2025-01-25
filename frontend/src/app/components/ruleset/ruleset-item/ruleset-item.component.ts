import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Ruleset } from '../../../services/ruleset.service';

@Component({
  selector: 'app-ruleset-item',
  templateUrl: './ruleset-item.component.html',
})
export class RulesetItemComponent {
  @Input() ruleset!: Ruleset;
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() duplicate = new EventEmitter<void>();

  onEdit() {
    this.edit.emit();
  }

  onDelete() {
    this.delete.emit();
  }

  onDuplicate() {
    this.duplicate.emit();
  }
}