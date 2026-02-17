/**
 * TVDB API Types
 * Based on show search and episode data APIs
 */

// Show search response from umlautadaptarr
export interface ShowSearchResponse {
	status: 'success' | 'error';
	germanTitle?: string;
	originalTitle?: string;
	tvdbId?: string;
	aliases?: string[];
	error?: string;
}

export interface ShowSearchResult {
	germanTitle: string;
	originalTitle: string;
	tvdbId: number;
	aliases: string[];
}

// Show data response from mediathekarr API
export interface TvdbShowDataResponse {
	data: TvdbShowData;
}

export interface TvdbShowData {
	id: number;
	name: string;
	germanName: string | null;
	image?: string;
	overview?: string;
	firstAired?: string;
	status?: string;
	episodes: TvdbEpisode[];
}

export interface TvdbEpisode {
	id?: number;
	name: string;
	aired: string;
	runtime: number;
	seasonNumber: number;
	episodeNumber: number;
	absoluteNumber: number;
	overview?: string;
}

// Calculated duration info for auto-filter suggestion
export interface DurationInfo {
	averageRuntime: number;
	analyzedEpisodes: number;
	suggestedMinDuration: number;
	/** The percentage used for suggestion (default 70%) */
	percentageUsed: number;
}

// Show type patterns (based on PLAN.md observations)
export type ShowType =
	| 'traditional'       // Traditional S##E## (e.g., Der Bergdoktor)
	| 'yearly_season'     // Uses year as season (e.g., Tatort)
	| 'absolute_episode'  // High episode count, uses absolute (e.g., Sturm der Liebe)
	| 'daily'             // Daily shows, often by date
	| 'unknown';

// Show type detection helpers
export interface ShowTypeAnalysis {
	type: ShowType;
	confidence: number;
	reasoning: string;
	suggestedStrategy: import('./ruleset').MatchingStrategy;
}

// API endpoints configuration
export const TVDB_API_ENDPOINTS = {
	showSearch: 'https://umlautadaptarr.pcjones.de/api/v1/tvshow_german.php',
	showData: 'https://mediathekarr.pcjones.de/api/v1/get_show.php'
} as const;
