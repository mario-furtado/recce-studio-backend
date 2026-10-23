import { CanDeactivateFn } from '@angular/router';

export const recceExitGuard: CanDeactivateFn<{ canDeactivate(): boolean }> = (component) => component.canDeactivate();
