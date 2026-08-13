import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';

import { Auth } from '../../../core/services/auth';
import { Token } from '../../../core/services/token';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule
  ],
  templateUrl: './login.html'
})
export class Login {

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly token = inject(Token);
  private readonly router = inject(Router);

  isLoading = false;
  loginError = '';

  loginForm = this.fb.nonNullable.group({

    email: [
      '',
      [
        Validators.required,
        Validators.email
      ]
    ],

    password: [
      '',
      [
        Validators.required,
        Validators.minLength(6)
      ]
    ],

    rememberMe: [false]
  });

  onLogin(): void {

    this.loginError = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    const credentials = {
      email: this.loginForm.controls.email.value,
      password: this.loginForm.controls.password.value
    };

    this.auth.login(credentials).subscribe({

      next: (response) => {

        console.log(
          'Login successful:',
          response
        );

        const token = response.data.token;

        if (!token) {

          console.error(
            'No token received from backend'
          );

          this.isLoading = false;

          this.loginError =
            'Login succeeded but no token was received.';

          return;
        }

        console.log(
          'Token received successfully'
        );

        /*
         * Store JWT
         */
        this.token.setToken(token);

        console.log(
          'Token saved:',
          this.token.getToken()
        );

        this.isLoading = false;

        /*
         * Navigate to Chat Dashboard
         */
        console.log(
          'Navigating to /chat'
        );

        this.router.navigate(['/chat'])
          .then((result) => {

            console.log(
              'Navigation result:',
              result
            );

          })
          .catch((error) => {

            console.error(
              'Navigation failed:',
              error
            );

          });
      },

      error: (error) => {

        console.error(
          'Login failed:',
          error
        );

        this.isLoading = false;

        this.loginError =
          error?.error?.message ??
          'Invalid email or password.';
      }

    });
  }

  get email() {
    return this.loginForm.controls.email;
  }

  get password() {
    return this.loginForm.controls.password;
  }

  get rememberMe() {
    return this.loginForm.controls.rememberMe;
  }
}