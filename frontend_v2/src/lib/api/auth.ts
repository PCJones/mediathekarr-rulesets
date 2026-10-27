/**
 * Authentication API Service
 * Login/register/GitHub OAuth and token management
 */

import { API_URL, apiRequest, ApiError, getAuthToken } from './client';

async function authRequest(path: string, body: unknown, fallbackError: string): Promise<string> {
	let result: { token: string };
	try {
		result = await apiRequest<{ token: string }>(`/auth${path}`, {
			method: 'POST',
			body: JSON.stringify(body)
		});
	} catch (e) {
		if (e instanceof ApiError) throw e;
		throw new Error(fallbackError);
	}

	localStorage.setItem('token', result.token);
	return result.token;
}

/** Login with email or username + password */
export function login(identifier: string, password: string): Promise<string> {
	return authRequest('', { identifier, password }, 'Login fehlgeschlagen');
}

/** Register a new account */
export function register(username: string, email: string, password: string): Promise<string> {
	return authRequest('/register', { username, email, password }, 'Registrierung fehlgeschlagen');
}

export interface GithubConfig {
	enabled: boolean;
	clientId: string;
}

/** Whether GitHub login is configured on the server */
export async function getGithubConfig(): Promise<GithubConfig> {
	try {
		const response = await fetch(`${API_URL}/auth/github`);
		if (!response.ok) return { enabled: false, clientId: '' };
		const result = await response.json();
		return result.data;
	} catch {
		return { enabled: false, clientId: '' };
	}
}

export function githubRedirectUri(): string {
	return `${window.location.origin}/auth/github/callback`;
}

/** Redirect the browser to GitHub's authorize page */
export function startGithubLogin(clientId: string): void {
	const state = crypto.randomUUID();
	sessionStorage.setItem('github_oauth_state', state);
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: githubRedirectUri(),
		scope: 'user:email',
		state
	});
	window.location.href = `https://github.com/login/oauth/authorize?${params}`;
}

/** Exchange the OAuth code (from the callback URL) for a token */
export function finishGithubLogin(code: string, state: string): Promise<string> {
	const expected = sessionStorage.getItem('github_oauth_state');
	sessionStorage.removeItem('github_oauth_state');
	if (!expected || expected !== state) {
		return Promise.reject(new Error('Ungültiger OAuth-Status. Bitte erneut versuchen.'));
	}
	return authRequest('/github', { code, redirectUri: githubRedirectUri() }, 'GitHub-Login fehlgeschlagen');
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
	return !!getAuthToken();
}

/**
 * Get current token
 */
export function getToken(): string | null {
	return getAuthToken();
}
