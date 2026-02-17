/**
 * Rulesets API Service
 * Communicates with v2 PHP backend for CRUD operations
 */

import type {
	Ruleset,
	Filter,
	RegexRule,
	RulesetListResponse,
	PredefinedTitlePattern,
	PredefinedSeasonEpisodePattern
} from '$types';

const API_URL = import.meta.env.VITE_API_URL || '/api/v2';

function getAuthToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem('token');
}

/**
 * Make authenticated API request to v2 backend
 * All v2 responses have format: { success: boolean, data?: T, error?: string }
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
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || `API Fehler: ${response.status}`);
	}

	const result = await response.json();

	if (!result.success) {
		throw new Error(result.error || 'API Fehler');
	}

	return result.data;
}

// ============ Ruleset CRUD ============

interface RawRuleset {
	id: number;
	mediaId: number | null;
	topic: string;
	priority: number;
	filters: Filter[];
	titleRegexRules: RegexRule[];
	episodeRegex: string | null;
	seasonRegex: string | null;
	matchingStrategy: string;
	media?: { name: string; tvdbId: number | null };
}

function mapRuleset(r: RawRuleset): Ruleset {
	return {
		id: r.id,
		mediaId: r.mediaId ?? undefined,
		topic: r.topic,
		priority: r.priority,
		filters: r.filters,
		titleRegexRules: r.titleRegexRules,
		episodeRegex: r.episodeRegex ?? undefined,
		seasonRegex: r.seasonRegex ?? undefined,
		matchingStrategy: r.matchingStrategy as Ruleset['matchingStrategy'],
		media: r.media
	};
}

/**
 * Get all rulesets (paginated)
 */
export async function getRulesets(
	page: number = 1,
	pageSize: number = 500
): Promise<RulesetListResponse> {
	const result = await apiRequest<{
		rulesets: RawRuleset[];
		total: number;
		page: number;
		pageSize: number;
		totalPages: number;
	}>(`/rulesets?page=${page}&pageSize=${pageSize}`);

	return {
		rulesets: result.rulesets.map(mapRuleset),
		total: result.total,
		page: result.page,
		pageSize: result.pageSize
	};
}

/**
 * Get rulesets for a specific media ID
 */
export async function getRulesetsForMedia(mediaId: number): Promise<Ruleset[]> {
	const rulesets = await apiRequest<RawRuleset[]>(`/media/${mediaId}/rulesets`);
	return rulesets.map(mapRuleset);
}

/**
 * Get a single ruleset by ID
 */
export async function getRuleset(id: number): Promise<Ruleset> {
	const ruleset = await apiRequest<RawRuleset>(`/rulesets/${id}`);
	return mapRuleset(ruleset);
}

/**
 * Create a new ruleset
 */
export async function createRuleset(ruleset: Omit<Ruleset, 'id'> & { mediaId?: number }): Promise<Ruleset> {
	const created = await apiRequest<RawRuleset>('/rulesets', {
		method: 'POST',
		body: JSON.stringify({
			mediaId: ruleset.mediaId,
			topic: ruleset.topic,
			priority: ruleset.priority,
			filters: ruleset.filters,
			titleRegexRules: ruleset.titleRegexRules,
			episodeRegex: ruleset.episodeRegex || null,
			seasonRegex: ruleset.seasonRegex || null,
			matchingStrategy: ruleset.matchingStrategy
		})
	});

	return mapRuleset(created);
}

/**
 * Update an existing ruleset
 */
export async function updateRuleset(id: number, ruleset: Partial<Ruleset>): Promise<Ruleset> {
	const updated = await apiRequest<RawRuleset>(`/rulesets/${id}`, {
		method: 'PUT',
		body: JSON.stringify({
			mediaId: ruleset.mediaId,
			topic: ruleset.topic,
			priority: ruleset.priority,
			filters: ruleset.filters,
			titleRegexRules: ruleset.titleRegexRules,
			episodeRegex: ruleset.episodeRegex || null,
			seasonRegex: ruleset.seasonRegex || null,
			matchingStrategy: ruleset.matchingStrategy
		})
	});

	return mapRuleset(updated);
}

/**
 * Delete a ruleset
 */
export async function deleteRuleset(id: number): Promise<void> {
	await apiRequest<null>(`/rulesets/${id}`, {
		method: 'DELETE'
	});
}

// ============ Predefined Patterns ============

/**
 * Get all predefined patterns
 */
export async function getPredefinedPatterns(): Promise<{
	titlePatterns: PredefinedTitlePattern[];
	seasonEpisodePatterns: PredefinedSeasonEpisodePattern[];
}> {
	return apiRequest('/patterns');
}

// ============ Export/Import ============

/**
 * Export ruleset as JSON
 */
export function exportRulesetAsJson(ruleset: Ruleset): string {
	const { id, ...exportData } = ruleset;
	return JSON.stringify(exportData, null, 2);
}

/**
 * Import ruleset from JSON string
 */
export function parseRulesetJson(json: string): Omit<Ruleset, 'id'> {
	const parsed = JSON.parse(json);

	if (!parsed.topic || !parsed.matchingStrategy) {
		throw new Error('Ungültiges Ruleset-Format: topic und matchingStrategy erforderlich');
	}

	return {
		topic: parsed.topic,
		tvdbId: parsed.tvdbId,
		priority: parsed.priority || 0,
		filters: Array.isArray(parsed.filters) ? parsed.filters : [],
		titleRegexRules: Array.isArray(parsed.titleRegexRules) ? parsed.titleRegexRules : [],
		matchingStrategy: parsed.matchingStrategy,
		seasonRegex: parsed.seasonRegex,
		episodeRegex: parsed.episodeRegex
	};
}
