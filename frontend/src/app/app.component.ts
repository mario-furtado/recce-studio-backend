import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SharedProperties } from './modules/core/shared/shared-properties';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'recce-studio';

  constructor(private readonly shared: SharedProperties) {}
}
