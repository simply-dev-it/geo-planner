import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
@Component({
  selector: 'gp-map-tools',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap gap-1.5' },
  template: ` <button
      class="gp-map-button"
      (click)="drawRequested.emit()"
      [disabled]="disabled()"
      [attr.aria-pressed]="drawing()"
    >
      {{ drawing() ? 'Przeciągnij na mapie…' : 'Zaznacz obszar' }}
    </button>
    @if (hasArea()) {
      <button
        class="gp-map-button"
        (click)="resizeRequested.emit(-50)"
        [disabled]="disabled()"
        aria-label="Zmniejsz obszar"
      >
        −</button
      ><button
        class="gp-map-button"
        (click)="resizeRequested.emit(50)"
        [disabled]="disabled()"
        aria-label="Powiększ obszar"
      >
        ＋
      </button>
    }`,
})
export class MapTools {
  readonly hasArea = input(false);
  readonly drawing = input(false);
  readonly disabled = input(false);
  readonly drawRequested = output<void>();
  readonly resizeRequested = output<number>();
}
