import {
  ChangeDetectionStrategy,
  Component,
  inject,
  ElementRef,
  effect,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageFrame } from 'ui';

import { SimulatorConnection } from './core/simulator/simulator-connection';
import { ApplicationErrorHandler } from './core/error-reporting/application-error-handler';

@Component({
  selector: 'app-root',
  imports: [PageFrame, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly catalogDialog = viewChild<ElementRef<HTMLDialogElement>>('catalogDialog');
  constructor() {
    effect(() => {
      const dialog = this.catalogDialog()?.nativeElement;
      if (this.simulator.open() && dialog && !dialog.open) dialog.showModal();
    });
  }
  protected closeCatalog() {
    this.catalogDialog()?.nativeElement.close();
    this.simulator.open.set(false);
  }
  protected readonly simulator = inject(SimulatorConnection);
  protected readonly errorHandler = inject(ApplicationErrorHandler);
}
