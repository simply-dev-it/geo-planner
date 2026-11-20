import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-foundation-page',
  imports: [RouterLink],
  templateUrl: './foundation-page.html',
  styleUrl: './foundation-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoundationPage {}
