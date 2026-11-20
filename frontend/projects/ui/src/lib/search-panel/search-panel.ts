import {
  ChangeDetectionStrategy,
  Component,
  input,
  inject,
  output,
  signal,
  computed,
  viewChild,
  ElementRef,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormField, form, maxLength } from '@angular/forms/signals';
export interface SearchState {
  query: string;
  regionId: string;
  type: string;
  countyName?: string;
  communeName?: string;
  localityName?: string;
  localityId?: string;
  inMap?: boolean;
  placeText?: string;
  streetText?: string;
  parcelText?: string;
  houseText?: string;
}
export interface SearchRow {
  id: string;
  label: string;
  context: string;
  kind: string;
}
export interface FilterOption {
  id: string;
  label: string;
  regionId?: string;
}

export type LookupStage = 'locality' | 'street' | 'number' | 'house' | 'parcel' | 'identifier';
let searchPanelSequence = 0;
@Component({
  selector: 'gp-search-panel',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  template: `<div class="flex min-h-0 flex-1 flex-col gap-3">
    @if (localityLabel()) {
      <nav aria-label="Miejsce wyszukiwania" class="flex shrink-0 flex-wrap gap-1 text-xs">
        <button
          type="button"
          class="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-900"
          (click)="stageChanged.emit('locality')"
        >
          {{ localityLabel() }} · Zmień
        </button>
        @if (streetLabel()) {
          <button
            type="button"
            class="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-900"
            (click)="stageChanged.emit('street')"
          >
            {{ streetLabel() }} · Zmień
          </button>
        }
      </nav>
    }
    @if (stage() === 'number') {
      <section class="space-y-3">
        <h2 class="text-base font-semibold">Co chcesz znaleźć?</h2>
        @if (streetLabel()) {
          <button type="button" class="gp-button w-full" (click)="stageChanged.emit('house')">
            Numer budynku
          </button>
        }
        <button type="button" class="gp-button w-full" (click)="stageChanged.emit('parcel')">
          Krótki numer działki
        </button>
        <button
          type="button"
          class="text-left text-xs font-semibold text-emerald-800 underline"
          (click)="mapSelectionRequested.emit()"
        >
          Pomiń numer — wybiorę na mapie
        </button>
      </section>
    } @else {
      @if (definition(); as field) {
        <form (submit)="$event.preventDefault(); submit()" class="shrink-0 space-y-2">
          <h2 class="text-base font-semibold">{{ field.heading }}</h2>
          <label class="gp-label" [for]="fieldId">{{ field.label }}</label>
          <div class="flex gap-2">
            <input
              #queryInput
              [id]="fieldId"
              type="search"
              autocomplete="off"
              class="gp-input min-w-0 flex-1"
              [placeholder]="field.placeholder"
              [formField]="fields[field.key]"
              (input)="edit($any($event.target).value)"
              (keydown.arrowdown)="$event.preventDefault(); focusFirst()"
              [attr.aria-controls]="resultId"
              [attr.aria-describedby]="fieldId + '-hint'"
            />
            <button
              type="submit"
              class="gp-button shrink-0 px-3"
              [attr.aria-label]="field.action"
              [disabled]="!model()[field.key].trim()"
            >
              Szukaj
            </button>
          </div>
          <p class="search-guidance text-xs leading-4 text-stone-500" [id]="fieldId + '-hint'">
            {{ field.hint }}
          </p>
        </form>
      }
      <div class="flex shrink-0 flex-wrap gap-x-3 gap-y-2 text-xs font-semibold text-emerald-800">
        @if (stage() === 'locality') {
          <button type="button" class="underline" (click)="stageChanged.emit('identifier')">
            Mam pełny numer działki
          </button>
          <button type="button" class="underline" (click)="mapSelectionRequested.emit()">
            Pomiń wyszukiwanie — wybiorę na mapie
          </button>
        } @else if (stage() === 'street') {
          <button type="button" class="underline" (click)="stageChanged.emit('number')">
            Pomiń ulicę
          </button>
        } @else if (stage() === 'identifier') {
          <button type="button" class="underline" (click)="stageChanged.emit('locality')">
            Szukaj po miejscowości
          </button>
        } @else {
          <button type="button" class="underline" (click)="stageChanged.emit('number')">
            Zmień rodzaj numeru
          </button>
          <button type="button" class="underline" (click)="mapSelectionRequested.emit()">
            Pomiń numer — wybiorę na mapie
          </button>
        }
      </div>
      <div
        [id]="resultId"
        role="region"
        aria-label="Wyniki wyszukiwania"
        class="min-h-0 flex-1 overflow-auto rounded-lg border border-stone-200"
        (keydown.escape)="focusActive()"
      >
        @if (sourceNotice()) {
          <p class="border-b border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
            {{ sourceNotice() }}
          </p>
        }
        @if (loading() && !rows().length) {
          <p class="p-4 text-sm text-stone-500" role="status">Wyszukiwanie…</p>
        }
        @if (error()) {
          <div class="p-4 text-sm text-red-800" role="status">
            {{ error() }}
            <button type="button" class="underline" (click)="retry.emit()">Spróbuj ponownie</button>
          </div>
        }
        @for (row of rows(); track row.id) {
          <button
            type="button"
            class="search-row group flex w-full gap-3 border-b border-stone-100 px-3 py-3 text-left hover:bg-emerald-50 focus-visible:bg-emerald-50"
            (click)="chosen.emit(row.id)"
          >
            <span
              class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-800"
              aria-hidden="true"
              >{{ row.kind === 'Działka' ? '▱' : '⌖' }}</span
            >
            <span class="min-w-0 flex-1"
              ><strong class="block text-sm font-semibold">{{ row.label }}</strong
              ><small class="block text-xs text-stone-500">{{ row.context }}</small></span
            ><span class="self-center text-[10px] text-stone-500">{{ row.kind }}</span>
          </button>
        }
        @if (!loading() && contextPrompt()) {
          <div class="p-3 text-sm text-emerald-900" role="status">
            {{ contextPrompt() }}
            <button
              type="button"
              class="mt-2 block font-semibold underline"
              (click)="stageChanged.emit('locality')"
            >
              Wybierz miejscowość lub adres
            </button>
          </div>
        }
        @if (!loading() && !error() && !contextPrompt() && !rows().length) {
          <p class="p-4 text-sm text-stone-500" role="status">
            {{
              !submitted()
                ? 'Wyniki pojawią się tutaj.'
                : 'Brak wyników w dostępnych danych. Zmień miejsce lub zapytanie.'
            }}
          </p>
        }
        @if (hasMore()) {
          <button
            type="button"
            class="w-full bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-900 disabled:opacity-50"
            [disabled]="loading()"
            (click)="more.emit()"
          >
            {{ loading() ? 'Wczytywanie…' : 'Pokaż więcej' }}
          </button>
        }
      </div>
    }
  </div>`,
})
export class SearchPanel implements OnChanges {
  readonly fieldId = `place-query-${++searchPanelSequence}`;
  readonly resultId = `${this.fieldId}-results`;
  readonly stage = input<LookupStage>('locality');
  readonly localityLabel = input<string | null>(null);
  readonly streetLabel = input<string | null>(null);
  readonly initial = input<SearchState>({ query: '', regionId: '', type: 'locality' });
  readonly rows = input<SearchRow[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly hasMore = input(false);
  readonly submitted = input(false);
  readonly sourceNotice = input<string | null>(null);
  readonly contextPrompt = input<string | null>(null);
  readonly requested = output<SearchState>();
  readonly changed = output<SearchState>();
  readonly stageChanged = output<LookupStage>();
  readonly mapSelectionRequested = output<void>();
  readonly chosen = output<string>();
  readonly more = output<void>();
  readonly retry = output<void>();
  readonly definition = computed(
    () =>
      (
        ({
          locality: {
            key: 'place',
            type: 'locality',
            heading: 'Znajdź miejscowość',
            label: 'Miejscowość',
            placeholder: 'Wpisz pełną nazwę',
            action: 'Szukaj miejscowości',
            hint: 'Wpisz pełną nazwę miejscowości i wybierz właściwy wynik.',
          },
          street: {
            key: 'street',
            type: 'street',
            heading: 'Wybierz ulicę lub pomiń',
            label: 'Ulica',
            placeholder: 'Wpisz nazwę lub fragment',
            action: 'Szukaj ulicy',
            hint: 'Wpisz fragment nazwy ulicy (minimum 3 znaki). Podpowiedzi pojawią się automatycznie.',
          },
          number: null,
          house: {
            key: 'house',
            type: 'address',
            heading: 'Znajdź adres',
            label: 'Numer budynku',
            placeholder: 'Wpisz numer, np. 1',
            action: 'Szukaj adresu',
            hint: 'Wpisz numer budynku przy wybranej ulicy i naciśnij Enter.',
          },
          parcel: {
            key: 'parcel',
            type: 'parcel',
            heading: 'Znajdź działkę',
            label: 'Krótki numer działki',
            placeholder: 'Wpisz numer, np. 101/1',
            action: 'Szukaj działki',
            hint: 'Wpisz numer działki. Aktualnie szukamy w widocznej okolicy mapy.',
          },
          identifier: {
            key: 'parcel',
            type: 'parcel',
            heading: 'Znajdź działkę po identyfikatorze',
            label: 'Pełny numer działki',
            placeholder: 'Wklej pełny identyfikator',
            action: 'Szukaj działki',
            hint: 'Pełny identyfikator wystarcza bez wybierania miejscowości.',
          },
        }) as const
      )[this.stage()],
  );
  readonly model = signal({ place: '', street: '', parcel: '', house: '' });
  readonly fields = form(this.model, (p) => {
    maxLength(p.place, 120);
    maxLength(p.street, 120);
    maxLength(p.parcel, 120);
    maxLength(p.house, 120);
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly queryInput = viewChild<ElementRef<HTMLInputElement>>('queryInput');
  ngOnChanges(changes: SimpleChanges) {
    if (!changes['initial']) return;
    const s = this.initial();
    this.model.set({
      place: s.placeText ?? (['locality', 'place', ''].includes(s.type) ? s.query : ''),
      street: s.streetText ?? (s.type === 'street' ? s.query : ''),
      parcel: s.parcelText ?? (s.type === 'parcel' ? s.query : ''),
      house: s.houseText ?? (s.type === 'address' ? s.query : ''),
    });
  }
  private state(): SearchState | null {
    const field = this.definition(),
      m = this.model();
    if (!field) return null;
    return {
      ...this.initial(),
      query: m[field.key],
      type: field.type,
      placeText: m.place,
      streetText: m.street,
      parcelText: m.parcel,
      houseText: m.house,
    };
  }
  edit(value: string) {
    const field = this.definition();
    if (!field) return;
    this.model.update((m) => ({ ...m, [field.key]: value }));
    const s = this.state();
    if (s) this.changed.emit(s);
  }
  submit() {
    const s = this.state();
    if (s?.query.trim()) this.requested.emit(s);
  }
  focusFirst() {
    this.host.nativeElement.querySelector<HTMLButtonElement>('.search-row')?.focus();
  }
  focusActive() {
    this.queryInput()?.nativeElement.focus();
  }
}
