export const API_URL = import.meta.env.VITE_API_URL || '/api/v2';

export class ApiError extends Error {
	status: number;
	data: unknown;

	constructor(message: string, status: number, data: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.data = data;
	}
}

export function getAuthToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem('token');
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const token = getAuthToken();

	const response = await fetch(`${API_URL}${endpoint}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...options.headers
		}
	});

	const body = await response.json().catch(() => null);

	if (!response.ok) {
		if (response.status === 401 && token) {
			localStorage.removeItem('token');
		}
		const fallback =
			response.status === 401
				? 'Nicht autorisiert. Bitte erneut anmelden.'
				: `API Fehler: ${response.status}`;
		throw new ApiError(body?.error || fallback, response.status, body);
	}

	if (!body?.success) {
		throw new ApiError(body?.error || 'API Fehler', response.status, body);
	}

	return body.data as T;
}
