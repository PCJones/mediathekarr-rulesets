import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <div class="min-h-screen bg-base-100 overflow-x-hidden">
      <div class="container mx-auto px-4 sm:px-6 flex flex-col items-center justify-center min-h-screen">
        <img 
          src="https://res.cloudinary.com/dsamsg1er/image/upload/v1732527976/ard_zlnpwp.png" 
          alt="MediathekARR" 
          class="h-32 sm:h-40 drop-shadow-xl filter brightness-75 mb-8"
        />

        <div class="w-full max-w-md bg-base-100 rounded-3xl shadow-2xl border border-base-content/10">
          <div class="p-6 border-b border-base-content/10">
            <div class="flex items-center gap-4">
              <div class="w-2 h-12 bg-primary rounded-full"></div>
              <h2 class="text-2xl font-bold">Login</h2>
            </div>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="p-6 space-y-4">
            <div class="form-control">
              <label class="label font-medium">Username</label>
              <input 
                type="text" 
                formControlName="username"
                class="input bg-base-200/50 border-base-content/10 rounded-2xl transition-all duration-300 focus:ring-2 focus:ring-primary/50 w-full"
                [class.input-error]="loginForm.get('username')?.invalid && loginForm.get('username')?.touched"
              />
              <label class="label" *ngIf="loginForm.get('username')?.invalid && loginForm.get('username')?.touched">
                <span class="label-text-alt text-error">Username wird benötigt</span>
              </label>
            </div>

            <div class="form-control">
              <label class="label font-medium">Passwort</label>
              <div class="relative">
                <input 
                  [type]="showPassword ? 'text' : 'password'"
                  formControlName="password"
                  class="input bg-base-200/50 border-base-content/10 rounded-2xl transition-all duration-300 focus:ring-2 focus:ring-primary/50 w-full"
                  [class.input-error]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
                />
                <button 
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2"
                  (click)="showPassword = !showPassword"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path *ngIf="!showPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    <path *ngIf="showPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                  </svg>
                </button>
              </div>
              <label class="label" *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched">
                <span class="label-text-alt text-error">Passwort wird benötigt</span>
              </label>
            </div>

            <div class="alert alert-error rounded-2xl" *ngIf="error">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{{ error }}</span>
            </div>

            <button 
              type="submit" 
              class="btn btn-primary w-full rounded-2xl"
              [disabled]="!loginForm.valid || isLoading"
            >
              <span *ngIf="isLoading" class="loading loading-spinner"></span>
              {{ isLoading ? 'Logging in...' : 'Login' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  error: string | null = null;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.error = null;
      
      const { username, password } = this.loginForm.value;
      this.authService.login(username, password).subscribe({
        next: () => {
          this.router.navigate(['/media']);
        },
        error: (err) => {
          this.error = err.error?.error || 'Login fehlgeschlagen. Versuche es erneut!';
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    }
  }
}