/**
 * Auth Store
 * Reactive authentication state with role tracking
 */

import { writable, derived } from 'svelte/store';
import type { UserRole, AuthUser } from '$types/auth';
import { getToken, logout as apiLogout } from '$api/auth';
import { onUnauthorized } from '$api/client';

interface AuthState {
	isAuthenticated: boolean;
	user: AuthUser | null;
	isLoading: boolean;
}

interface TokenPayload {
	userId?: number | string;
	username?: string;
	email?: string;
	sub?: string;
	role?: UserRole;
	exp?: number;
}

const initialState: AuthState = {
	isAuthenticated: false,
	user: null,
	isLoading: true
};

const loggedOutState: AuthState = {
	isAuthenticated: false,
	user: null,
	isLoading: false
};

/** setTimeout overflows above ~24.8 days; re-check instead of waiting that long in one go. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

function decodeTokenPayload(token: string): TokenPayload | null {
	try {
		const base64UrlPayload = token.split('.')[1];
		const base64Payload = base64UrlPayload.replace(/-/g, '+').replace(/_/g, '/');
		return JSON.parse(atob(base64Payload)) as TokenPayload;
	} catch {
		return null;
	}
}

function isTokenExpired(payload: TokenPayload): boolean {
	return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
}

function createAuthStore() {
	const { subscribe, set } = writable<AuthState>(initialState);
	let expiryTimer: ReturnType<typeof setTimeout> | null = null;

	function clearExpiryTimer() {
		if (expiryTimer) {
			clearTimeout(expiryTimer);
			expiryTimer = null;
		}
	}

	function logout() {
		clearExpiryTimer();
		apiLogout();
		set(loggedOutState);
	}

	function scheduleExpiry(expiresAtSeconds: number) {
		clearExpiryTimer();
		const millisecondsUntilExpiry = expiresAtSeconds * 1000 - Date.now();
		expiryTimer = setTimeout(
			() => {
				expiryTimer = null;
				init();
			},
			Math.min(Math.max(millisecondsUntilExpiry, 0), MAX_TIMER_DELAY_MS)
		);
	}

	/** Initialize auth state from stored token; an expired or unreadable token counts as logged out. */
	function init() {
		const token = getToken();
		const payload = token ? decodeTokenPayload(token) : null;

		if (!payload || isTokenExpired(payload)) {
			logout();
			return;
		}

		const email = payload.email || payload.sub || '';
		const username = payload.username || '';
		set({
			isAuthenticated: true,
			user: {
				id: Number(payload.userId) || 0,
				email,
				username,
				role: payload.role || 'user',
				displayName: username || email.split('@')[0]
			},
			isLoading: false
		});

		if (typeof payload.exp === 'number') {
			scheduleExpiry(payload.exp);
		} else {
			clearExpiryTimer();
		}
	}

	// The server rejected the token (expired, revoked, re-keyed): reflect that in the UI.
	onUnauthorized(logout);

	return {
		subscribe,
		init,

		/** Set authenticated user after login */
		setUser: (user: AuthUser) => {
			set({
				isAuthenticated: true,
				user,
				isLoading: false
			});
		},

		/** Log out and clear state */
		logout
	};
}

export const authStore = createAuthStore();

// Derived stores for convenience
export const isAdmin = derived(authStore, ($auth) => $auth.user?.role === 'admin');
export const isUser = derived(authStore, ($auth) => $auth.isAuthenticated && $auth.user?.role !== 'guest');
export const userRole = derived(authStore, ($auth): UserRole => $auth.user?.role || 'guest');
export const isAuthenticated = derived(authStore, ($auth) => $auth.isAuthenticated);
