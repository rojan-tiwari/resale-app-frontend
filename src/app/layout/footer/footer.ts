import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Logo } from '../../shared/components/logo';

@Component({
  selector: 'app-footer',
  imports: [Logo],
  host: { role: 'contentinfo', class: 'block border-t border-slate-200 bg-white' },
  template: `
    <div class="container-page flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
      <app-logo [name]="appName" />
      <p class="text-sm text-slate-600">
        Buy and sell second-hand across Nepal. Prices in NPR.
      </p>
    </div>
  `,
})
export class Footer {
  protected readonly appName = environment.appName;
}
