/**
 * Media API Service
 * CRUD operations for shows/movies
 */

import type { Media } from '$types';

// API URL for all endpoints
const API_URL = import.meta.env.VITE_API_URL || '/api/v2';

/**
 * Get auth token from storage
 */
function getAuthToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem('token');
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> {
	const token = getAuthToken();

	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...options.headers
	};

	const response = await fetch(`${API_URL}${endpoint}`, {
		...options,
		headers
	});

	if (!response.ok) {
		if (response.status === 401) {
			localStorage.removeItem('token');
			throw new Error('Nicht autorisiert. Bitte erneut anmelden.');
		}
		throw new Error(`API Fehler: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get all media (shows/movies)
 */
export async function getAllMedia(): Promise<Media[]> {
	const result = await apiRequest<{ success: boolean; data: Media[] }>('/media');
	return result.data;
}

/**
 * Get single media by ID
 */
export async function getMedia(id: number): Promise<Media> {
	const result = await apiRequest<{ success: boolean; data: Media }>(`/media/${id}`);
	return result.data;
}

/**
 * Create new media
 */
export async function createMedia(media: Omit<Media, 'id'>): Promise<{ id: number }> {
	const result = await apiRequest<{ success: boolean; data: { id: number } }>('/media', {
		method: 'POST',
		body: JSON.stringify(media)
	});
	return result.data;
}

/**
 * Update existing media
 */
export async function updateMedia(id: number, media: Partial<Media>): Promise<void> {
	await apiRequest<{ success: boolean }>(`/media/${id}`, {
		method: 'PUT',
		body: JSON.stringify(media)
	});
}

/**
 * Delete media
 */
export async function deleteMedia(id: number): Promise<void> {
	await apiRequest<void>(`/media/${id}`, {
		method: 'DELETE'
	});
}

/**
 * Get TVDB cover image URL
 */
export function getTvdbCoverUrl(tvdbId: number): string {
	return `https://artworks.thetvdb.com/banners/posters/${tvdbId}-1.jpg`;
}
