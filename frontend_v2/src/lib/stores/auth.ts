/**
 * Auth Store
 * Reactive authentication state with role tracking
 */

import { writable, derived } from 'svelte/store';
import type { UserRole, AuthUser } from '$types/auth';
import { isLoggedIn, getToken, logout as apiLogout } from '$api/auth';

interface AuthState {
	isAuthenticated: boolean;
	user: AuthUser | null;
	isLoading: boolean;
}

const initialState: AuthState = {
	isAuthenticated: false,
	user: null,
	isLoading: true
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);

	return {
		subscribe,

		/** Initialize auth state from stored token */
		init: () => {
			const authenticated = isLoggedIn();
			if (authenticated) {
				// Decode role from JWT token (simplified - in production, validate server-side)
				const token = getToken();
				let role: UserRole = 'user';
				let email = '';
				let username = '';

				if (token) {
					try {
						const payload = JSON.parse(atob(token.split('.')[1]));
						role = payload.role || 'user';
						email = payload.email || payload.sub || '';
						username = payload.username || '';
					} catch {
						// Token parse failed, use defaults
					}
				}

				set({
					isAuthenticated: true,
					user: { email, username, role, displayName: username || email.split('@')[0] },
					isLoading: false
				});
			} else {
				set({
					isAuthenticated: false,
					user: null,
					isLoading: false
				});
			}
		},

		/** Set authenticated user after login */
		setUser: (user: AuthUser) => {
			set({
				isAuthenticated: true,
				user,
				isLoading: false
			});
		},

		/** Log out and clear state */
		logout: () => {
			apiLogout();
			set({
				isAuthenticated: false,
				user: null,
				isLoading: false
			});
		}
	};
}

export const authStore = createAuthStore();

// Derived stores for convenience
export const isAdmin = derived(authStore, ($auth) => $auth.user?.role === 'admin');
export const isUser = derived(authStore, ($auth) => $auth.isAuthenticated && $auth.user?.role !== 'guest');
export const userRole = derived(authStore, ($auth): UserRole => $auth.user?.role || 'guest');
export const isAuthenticated = derived(authStore, ($auth) => $auth.isAuthenticated);
