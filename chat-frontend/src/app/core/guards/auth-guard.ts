import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';

import { Token } from '../services/token';

export const authGuard: CanActivateFn = () => {

  const token = inject(Token);
  const router = inject(Router);

  if (token.hasToken()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};