/**
 * Media API Service
 * CRUD operations for shows/movies
 */

import type { Media } from '$types';
import { apiRequest } from './client';

/**
 * Get all media (shows/movies)
 */
export async function getAllMedia(options: { withSuggestionCounts?: boolean } = {}): Promise<Media[]> {
	const query = options.withSuggestionCounts ? '?withSuggestionCounts=1' : '';
	return apiRequest<Media[]>(`/media${query}`);
}

/**
 * Get single media by ID
 */
export async function getMedia(id: number): Promise<Media> {
	return apiRequest<Media>(`/media/${id}`);
}

/**
 * Create new media
 */
export async function createMedia(media: Omit<Media, 'id'>): Promise<{ id: number }> {
	return apiRequest<{ id: number }>('/media', {
		method: 'POST',
		body: JSON.stringify(media)
	});
}

/**
 * Update existing media
 */
export async function updateMedia(id: number, media: Partial<Media>): Promise<void> {
	await apiRequest<unknown>(`/media/${id}`, {
		method: 'PUT',
		body: JSON.stringify(media)
	});
}

/**
 * Delete media
 */
export async function deleteMedia(id: number): Promise<void> {
	await apiRequest<unknown>(`/media/${id}`, {
		method: 'DELETE'
	});
}

/**
 * Get TVDB cover image URL
 */
export function getTvdbCoverUrl(tvdbId: number): string {
	return `https://artworks.thetvdb.com/banners/posters/${tvdbId}-1.jpg`;
}
