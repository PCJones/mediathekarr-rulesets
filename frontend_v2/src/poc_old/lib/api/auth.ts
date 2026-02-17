/**
 * Authentication API Service
 * Login/logout and token management
 */

const API_URL = import.meta.env.VITE_API_URL || '/api/v2';

export interface LoginResponse {
	success: boolean;
	data: { token: string };
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<string> {
	const response = await fetch(`${API_URL}/auth`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error || 'Login fehlgeschlagen');
	}

	const result: LoginResponse = await response.json();
	localStorage.setItem('token', result.data.token);
	return result.data.token;
}

/**
 * Logout - remove token
 */
export function logout(): void {
	localStorage.removeItem('token');
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return !!localStorage.getItem('token');
}

/**
 * Get current token
 */
export function getToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem('token');
}
