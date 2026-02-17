/**
 * Media Types
 * Represents shows/movies that can have rulesets
 */

export type MediaType = 'show' | 'movie';

export interface Media {
	id: number;
	name: string;
	type: MediaType;
	tmdbId?: number | null;
	imdbId?: string | null;
	tvdbId?: number | null;
	coverUrl?: string;
}

export interface MediaWithRulesetCount extends Media {
	rulesetCount: number;
}

export interface MediaApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface MediaListResponse {
	media: Media[];
	total: number;
}
