import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
} from '@angular/core';
import { ConfirmDialogService } from './confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  @ViewChild('confirmButton') confirmButton?: ElementRef<HTMLButtonElement>;
  readonly state$ = this.confirmDialog.state$;

  constructor(public confirmDialog: ConfirmDialogService) {}

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.confirmDialog.dismiss();
  }

  onDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
