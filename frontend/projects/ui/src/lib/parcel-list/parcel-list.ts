import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
export interface ParcelRow {
  id: string;
  label: string;
  context?: string;
}
@Component({
  selector: 'gp-parcel-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <ul [attr.aria-label]="label()" class="space-y-1.5">
    @for (row of rows(); track row.id) {
      <li
        [attr.data-parcel-id]="row.id"
        class="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2"
      >
        <span class="min-w-0 flex-1"
          ><strong class="block text-sm font-medium">{{ row.label }}</strong
          ><small class="block truncate text-xs text-stone-500" [title]="row.context ?? ''">{{
            row.context
          }}</small></span
        >
        @if (!readOnly()) {
          <button
            type="button"
            class="rounded-md px-2 py-1 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
            [disabled]="disabled()"
            [attr.aria-label]="action() + ' działkę ' + row.label"
            (click)="acted.emit(row.id)"
          >
            {{ action() === 'Usuń' ? '×' : action() }}
          </button>
        }
      </li>
    }
  </ul>`,
})
export class ParcelList {
  readonly rows = input<ParcelRow[]>([]);
  readonly label = input('Wybrane działki');
  readonly action = input('Usuń');
  readonly disabled = input(false);
  readonly readOnly = input(false);
  readonly acted = output<string>();
}
