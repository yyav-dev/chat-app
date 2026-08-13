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

import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule
  ],
  templateUrl: './register.html'
})
export class Register {

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  isLoading = false;
  registerError = '';

  registerForm = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.minLength(2)
      ]
    ],

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

    confirmPassword: [
      '',
      [
        Validators.required
      ]
    ]
  });

  onRegister(): void {

    this.registerError = '';

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const {
      name,
      email,
      password,
      confirmPassword
    } = this.registerForm.getRawValue();

    // Check password confirmation
    if (password !== confirmPassword) {
      this.registerError = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;

    const registerData = {
      name,
      email,
      password
    };

    this.auth.register(registerData).subscribe({

      next: (response) => {

        console.log(
          'Registration successful:',
          response
        );

        this.isLoading = false;

        this.registerError = '';

        this.router.navigate(['/login'])
      },

      error: (error) => {

        console.error(
          'Registration failed:',
          error
        );

        this.isLoading = false;

        this.registerError =
          error?.error?.message ??
          'Registration failed. Please try again.';
      }

    });
  }

  get name() {
    return this.registerForm.controls.name;
  }

  get email() {
    return this.registerForm.controls.email;
  }

  get password() {
    return this.registerForm.controls.password;
  }

  get confirmPassword() {
    return this.registerForm.controls.confirmPassword;
  }
}