import { CanDeactivateFn } from '@angular/router';

export const recceExitGuard: CanDeactivateFn<{ canDeactivate(): boolean | Promise<boolean> }> = (component) => component.canDeactivate();
