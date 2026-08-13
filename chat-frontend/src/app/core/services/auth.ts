import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: AuthUser;
    token: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class Auth {

  private readonly http = inject(HttpClient);

  private readonly apiUrl = environment.apiUrl;

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/auth/login`,
      credentials
    );
  }

  register(data: RegisterRequest): Observable<unknown> {
    return this.http.post(
      `${this.apiUrl}/auth/register`,
      data
    );
  }
}