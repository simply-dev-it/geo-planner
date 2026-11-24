import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { ParcelList, SearchPanel, WorkflowSteps, MapTools } from 'ui';
import { AoiMapAdapter } from './aoi-map-adapter';
import { ProjectCreationState } from './project-creation-state';
@Component({
  selector: 'app-project-creation-page',
  providers: [ProjectCreationState],
  imports: [FormField, ParcelList, SearchPanel, WorkflowSteps, MapTools],
  templateUrl: './project-creation-page.html',
  styleUrl: './project-creation-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCreationPage implements AfterViewInit, OnDestroy {
  readonly state = inject(ProjectCreationState);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('mapHost');
  private readonly adapter = signal<AoiMapAdapter | null>(null);
  readonly mapAvailable = signal(true);
  readonly drawing = signal(false);
  readonly sourceOpen = signal(false);
  readonly attributions = signal<readonly string[]>([]);
  readonly previewWarnings = computed(() => this.state.preview()?.warnings.length ?? 0);
  constructor() {
    effect(() => {
      this.adapter()?.setContextParcels([...this.state.contextParcels()]);
      this.adapter()?.setParcels([...this.state.selected()]);
      const located = this.state.locatedParcel();
      const suggestions = new Map(this.state.suggested().map((p) => [p.id, p]));
      if (located && this.state.canAddLocated()) suggestions.set(located.id, located);
      this.adapter()?.setSuggestedParcels(this.state.step() < 2 ? [...suggestions.values()] : []);
    });
    effect(() => {
      const b = this.state.bounds();
      this.adapter()?.setExtent(b ? [...b] : null);
    });
    effect(() => {
      const b = this.state.camera();
      if (b) this.adapter()?.fitExtent([...b]);
    });
    effect(() => this.adapter()?.setEditingEnabled(this.state.canEditArea()));
  }
  ngAfterViewInit() {
    this.adapter.set(
      new AoiMapAdapter(this.host().nativeElement, this.state.tileUrl(), {
        onParcelToggle: (id) => this.state.remove(id),
        onViewportChanged: (b) => this.state.viewportChanged(b),
        onPoint: (p) => this.state.resolvePoint(p),
        onExtentChanged: (b) => {
          this.drawing.set(false);
          this.state.setBounds(b);
        },
        onTileError: () => this.mapAvailable.set(false),
        onTileLoaded: () => this.mapAvailable.set(true),
        onDrawFinished: () => this.drawing.set(false),
        onAttributionsChanged: (texts) => this.attributions.set(texts),
      }),
    );
  }
  draw() {
    if (this.state.canEditArea()) {
      this.adapter()?.startDraw();
      this.drawing.set(true);
    }
  }
  ngOnDestroy() {
    this.adapter()?.destroy();
  }
}
