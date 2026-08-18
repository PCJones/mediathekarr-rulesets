/**
 * Authentication API Service
 * Login/register/GitHub OAuth and token management
 */

const API_URL = import.meta.env.VITE_API_URL || '/api/v2';

interface TokenResponse {
	success: boolean;
	data: { token: string };
}

async function authRequest(path: string, body: unknown, fallbackError: string): Promise<string> {
	const response = await fetch(`${API_URL}/auth${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error || fallbackError);
	}

	const result: TokenResponse = await response.json();
	localStorage.setItem('token', result.data.token);
	return result.data.token;
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
