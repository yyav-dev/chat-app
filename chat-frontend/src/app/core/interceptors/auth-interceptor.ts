import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { Token } from '../services/token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const tokenService = inject(Token);

  const token = tokenService.getToken();

  if (!token) {
    return next(req);
  }

  const authRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authRequest);
};