/**
 * MediathekViewWeb API Types
 * Based on POST https://mediathekviewweb.de/api/query
 */

import type { TvdbEpisode } from './tvdb';

// Query request structure
export interface MediathekQuery {
	fields: MediathekQueryField[];
	query: string;
}

export type MediathekQueryField = 'topic' | 'title' | 'description' | 'channel';

export interface MediathekQueryRequest {
	queries: MediathekQuery[];
	sortBy?: MediathekSortField;
	sortOrder?: 'asc' | 'desc';
	future?: boolean;
	offset?: number;
	size?: number;
}

export type MediathekSortField =
	| 'filmlisteTimestamp'
	| 'timestamp'
	| 'duration'
	| 'channel';

// API response structure
export interface MediathekApiResponse {
	result: {
		results: MediathekItem[];
		queryInfo: {
			filmlisteTimestamp: number;
			searchEngineTime: number;
			resultCount: number;
			totalResults: number;
		};
	};
	err: string | null;
}

// Individual media item from API
export interface MediathekItem {
	id: string;
	channel: string;
	topic: string;
	title: string;
	description: string;
	timestamp: number;
	duration: number;
	size: number;
	url_video: string;
	url_video_hd?: string;
	url_video_low?: string;
	url_website?: string;
	url_subtitle?: string;
	filmlisteTimestamp?: number;
}

// Extended item with sandbox evaluation results
export interface MediathekItemWithEvaluation extends MediathekItem {
	evaluation: ItemEvaluation;
}

// Evaluation result for sandbox
export interface ItemEvaluation {
	/** Overall status */
	status: 'matched' | 'failed' | 'skipped';
	/** Individual filter check results */
	filterChecks: FilterCheckResult[];
	/** Title construction steps */
	titleConstruction: TitleConstructionStep[];
	/** Final constructed title (or null if construction failed) */
	constructedTitle: string | null;
	/** Season/episode extraction results (if applicable) */
	seasonEpisodeExtraction?: SeasonEpisodeExtraction;
	/** TVDB match result (if applicable) */
	tvdbMatch?: TvdbMatchResult;
	/** Matched TVDB episode (if applicable) */
	tvdbEpisode?: TvdbEpisode | null;
	/** Skip reason if skipped */
	skipReason?: string;
}

export interface FilterCheckResult {
	filterIndex: number;
	attribute: string;
	type: string;
	expectedValue: string;
	actualValue: string;
	passed: boolean;
	/** Human-readable explanation */
	explanation: string;
}

export interface TitleConstructionStep {
	stepIndex: number;
	ruleType: 'static' | 'regex';
	/** Input value (for static) or pattern (for regex) */
	input: string;
	/** Field used (for regex rules) */
	field?: string;
	/** Result of this step */
	result: string | null;
	/** Whether this step succeeded */
	success: boolean;
	/** Running title after this step */
	runningTitle: string;
	/** Error message if failed */
	error?: string;
}

export interface SeasonEpisodeExtraction {
	seasonRegex: string;
	episodeRegex: string;
	seasonValue: string | null;
	episodeValue: string | null;
	isSeasonStatic: boolean;
	isEpisodeStatic: boolean;
	success: boolean;
}

export interface TvdbMatchResult {
	searched: boolean;
	found: boolean;
	searchParams?: {
		season?: number;
		episode?: number;
		title?: string;
		airdate?: string;
	};
	matchedEpisode?: {
		name: string;
		seasonNumber: number;
		episodeNumber: number;
		aired: string;
	};
	error?: string;
}

// Keywords that cause automatic skipping
export const SKIP_KEYWORDS = [
	'Audiodeskription',
	'(AD)',
	'Hörfassung',
	'Gebärdensprache',
	'(OmU)',
	'(OV)',
	'Originalversion'
] as const;

// Default query configuration
export const DEFAULT_QUERY_CONFIG: Partial<MediathekQueryRequest> = {
	sortBy: 'filmlisteTimestamp',
	sortOrder: 'desc',
	future: true,
	offset: 0,
	size: 100
};
