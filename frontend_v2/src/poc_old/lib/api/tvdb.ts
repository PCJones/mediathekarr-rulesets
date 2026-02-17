/**
 * TVDB API Service
 * - Show search via umlautadaptarr
 * - Show/episode data via mediathekarr API
 */

import type {
	ShowSearchResponse,
	ShowSearchResult,
	TvdbShowDataResponse,
	TvdbShowData,
	TvdbEpisode,
	DurationInfo
} from '$types';
import { generateCacheKey, getFromCache, setInCache } from './cache';
import { TVDB_API_ENDPOINTS } from '$types';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes for TVDB data

/**
 * Search for a show by title (German or original)
 */
export async function searchShow(title: string): Promise<ShowSearchResult | null> {
	if (!title.trim()) {
		return null;
	}

	const cacheKey = generateCacheKey('tvdb_search', { title });
	const cached = getFromCache<ShowSearchResult>(cacheKey);
	if (cached) {
		return cached;
	}

	const url = `${TVDB_API_ENDPOINTS.showSearch}?title=${encodeURIComponent(title)}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Show search failed: ${response.status}`);
	}

	const data: ShowSearchResponse = await response.json();

	if (data.status !== 'success' || !data.tvdbId) {
		return null;
	}

	const result: ShowSearchResult = {
		germanTitle: data.germanTitle || title,
		originalTitle: data.originalTitle || title,
		tvdbId: parseInt(data.tvdbId, 10),
		aliases: data.aliases || []
	};

	setInCache(cacheKey, result, CACHE_TTL_MS);
	return result;
}

/**
 * Get show data including episodes by TVDB ID
 */
export async function getShowData(tvdbId: number): Promise<TvdbShowData | null> {
	const cacheKey = generateCacheKey('tvdb_show', { tvdbId });
	const cached = getFromCache<TvdbShowData>(cacheKey);
	if (cached) {
		return cached;
	}

	const url = `${TVDB_API_ENDPOINTS.showData}?tvdbid=${tvdbId}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Show data fetch failed: ${response.status}`);
	}

	const data: TvdbShowDataResponse = await response.json();

	if (!data.data) {
		return null;
	}

	setInCache(cacheKey, data.data, CACHE_TTL_MS);
	return data.data;
}

/**
 * Find episode by season and episode number
 */
export function findEpisodeBySeasonEpisode(
	episodes: TvdbEpisode[],
	season: number,
	episode: number
): TvdbEpisode | null {
	return episodes.find(
		ep => ep.seasonNumber === season && ep.episodeNumber === episode
	) || null;
}

/**
 * Find episode by absolute number
 * Note: Some shows use episodeNumber as absolute count when absoluteNumber is 0
 */
export function findEpisodeByAbsolute(
	episodes: TvdbEpisode[],
	absoluteNumber: number
): TvdbEpisode | null {
	// First try absoluteNumber field
	let episode = episodes.find(ep => ep.absoluteNumber === absoluteNumber);

	// If not found and absoluteNumber fields are mostly 0, try episodeNumber
	if (!episode) {
		const hasAbsoluteNumbers = episodes.some(ep => ep.absoluteNumber > 0);
		if (!hasAbsoluteNumbers) {
			episode = episodes.find(ep => ep.episodeNumber === absoluteNumber);
		}
	}

	return episode || null;
}

/**
 * Find episode by title (includes or exact match)
 */
export function findEpisodeByTitle(
	episodes: TvdbEpisode[],
	title: string,
	exact: boolean = false
): TvdbEpisode | null {
	const normalizedTitle = title.toLowerCase().trim();

	if (exact) {
		return episodes.find(ep => ep.name.toLowerCase().trim() === normalizedTitle) || null;
	}

	// Includes match
	return episodes.find(ep => {
		const epName = ep.name.toLowerCase();
		return epName.includes(normalizedTitle) || normalizedTitle.includes(epName);
	}) || null;
}

/**
 * Find episode by air date
 */
export function findEpisodeByAirdate(
	episodes: TvdbEpisode[],
	airdate: string
): TvdbEpisode | null {
	// Normalize date format to YYYY-MM-DD
	const normalizedDate = normalizeDate(airdate);
	if (!normalizedDate) {
		return null;
	}

	return episodes.find(ep => ep.aired === normalizedDate) || null;
}

/**
 * Parse German date formats to YYYY-MM-DD
 */
export function normalizeDate(dateStr: string): string | null {
	const trimmed = dateStr.trim();

	// Already ISO format
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		return trimmed;
	}

	// German format: "7. Juni 2024" or "07.06.2024"
	const germanMonths: Record<string, string> = {
		'januar': '01', 'februar': '02', 'märz': '03', 'april': '04',
		'mai': '05', 'juni': '06', 'juli': '07', 'august': '08',
		'september': '09', 'oktober': '10', 'november': '11', 'dezember': '12'
	};

	// Try "7. Juni 2024" format
	const longMatch = trimmed.match(/(\d{1,2})\.\s*(\w+)\s+(\d{4})/i);
	if (longMatch) {
		const [, day, monthName, year] = longMatch;
		const month = germanMonths[monthName.toLowerCase()];
		if (month) {
			return `${year}-${month}-${day.padStart(2, '0')}`;
		}
	}

	// Try "07.06.2024" format
	const shortMatch = trimmed.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
	if (shortMatch) {
		const [, day, month, year] = shortMatch;
		return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
	}

	return null;
}

/**
 * Calculate duration info from episodes for auto-filter suggestion
 */
export function calculateDurationInfo(
	episodes: TvdbEpisode[],
	percentageForSuggestion: number = 0.7
): DurationInfo {
	// Use last 100 episodes (most recent)
	const recentEpisodes = episodes
		.filter(ep => ep.runtime > 0)
		.slice(-100);

	if (recentEpisodes.length === 0) {
		return {
			averageRuntime: 0,
			analyzedEpisodes: 0,
			suggestedMinDuration: 0,
			percentageUsed: percentageForSuggestion
		};
	}

	const totalRuntime = recentEpisodes.reduce((sum, ep) => sum + ep.runtime, 0);
	const averageRuntime = Math.round(totalRuntime / recentEpisodes.length);

	return {
		averageRuntime,
		analyzedEpisodes: recentEpisodes.length,
		suggestedMinDuration: Math.round(averageRuntime * percentageForSuggestion),
		percentageUsed: percentageForSuggestion
	};
}

/**
 * Detect show type based on episode patterns
 */
export function detectShowType(episodes: TvdbEpisode[]): {
	type: 'traditional' | 'yearly_season' | 'absolute_episode' | 'daily' | 'unknown';
	reasoning: string;
} {
	if (episodes.length === 0) {
		return { type: 'unknown', reasoning: 'Keine Episoden gefunden' };
	}

	// Check if seasons are years (like Tatort)
	const seasons = [...new Set(episodes.map(ep => ep.seasonNumber))];
	const yearlySeasons = seasons.filter(s => s >= 1970 && s <= 2100);
	if (yearlySeasons.length > seasons.length * 0.8) {
		return {
			type: 'yearly_season',
			reasoning: `Staffeln sind Jahre (${yearlySeasons[0]}-${yearlySeasons[yearlySeasons.length - 1]})`
		};
	}

	// Check for high episode count (soap opera style)
	const maxEpisode = Math.max(...episodes.map(ep => ep.episodeNumber));
	if (maxEpisode > 500 || episodes.length > 500) {
		return {
			type: 'absolute_episode',
			reasoning: `Hohe Episodenzahl (${episodes.length}+ Episoden)`
		};
	}

	// Check for traditional season/episode pattern
	const maxSeason = Math.max(...seasons);
	if (maxSeason > 0 && maxSeason < 50) {
		return {
			type: 'traditional',
			reasoning: `Traditionelles Format (${maxSeason} Staffeln)`
		};
	}

	return { type: 'unknown', reasoning: 'Muster nicht erkannt' };
}
