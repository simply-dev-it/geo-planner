import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
@Component({
  selector: 'gp-workflow-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav aria-label="Etapy projektu" class="flex gap-1">
    @for (label of labels; track $index) {
      <button
        type="button"
        class="flex-1 rounded-md px-1 py-2 text-xs font-semibold transition-colors"
        [class]="step() === $index ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-stone-500'"
        [attr.aria-current]="step() === $index ? 'step' : null"
        [disabled]="disabled() || $index > step()"
        (click)="changed.emit($index)"
      >
        {{ $index + 1 }} {{ label }}
      </button>
    }
  </nav>`,
})
export class WorkflowSteps {
  readonly labels = ['Wyszukaj', 'Obszar', 'Podgląd'];
  readonly step = input(0);
  readonly disabled = input(false);
  readonly changed = output<number>();
}
