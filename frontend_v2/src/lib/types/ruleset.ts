/**
 * Core Ruleset Types
 * Based on PLAN.md specifications and backend data structures
 */

// Filter types for narrowing down API results
export type FilterAttribute = 'duration' | 'channel' | 'title' | 'topic' | 'description';
export type FilterType = 'GreaterThan' | 'LessThan' | 'Equals' | 'Contains' | 'Regex';

export interface Filter {
	attribute: FilterAttribute;
	type: FilterType;
	value: string;
}

// Regex rule types for title construction
export type RegexRuleType = 'static' | 'regex';
export type RegexRuleField = 'title' | 'topic' | 'description' | 'channel';

export interface RegexRule {
	type: RegexRuleType;
	/** For static rules: the literal text to append */
	value?: string;
	/** For regex rules: which API field to extract from */
	field?: RegexRuleField;
	/** For regex rules: the regex pattern (first capture group is used) */
	pattern?: string;
}

// Matching strategies for TVDB episode lookup
export type MatchingStrategy =
	| 'SeasonAndEpisodeNumber'    // Extract S##E## from title
	| 'ByAbsoluteEpisodeNumber'   // Legacy - use episode number as absolute
	| 'AbsoluteEpisodeNumber'     // Episode number as absolute count
	| 'ItemTitleExact'            // Constructed title = TVDB episode name
	| 'ItemTitleIncludes'         // Constructed title is substring of TVDB name
	| 'ItemTitleEqualsAirdate';   // Constructed title parsed as date → match by airdate

// Strategy metadata for UI display
export interface MatchingStrategyInfo {
	value: MatchingStrategy;
	label: string;
	description: string;
	requiresSeasonRegex: boolean;
	requiresEpisodeRegex: boolean;
	requiresTitleRules: boolean;
}

export const MATCHING_STRATEGIES: MatchingStrategyInfo[] = [
	{
		value: 'SeasonAndEpisodeNumber',
		label: 'Season + Episode',
		description: 'Extrahiert S##E## aus dem Titel (z.B. "S19/E03")',
		requiresSeasonRegex: true,
		requiresEpisodeRegex: true,
		requiresTitleRules: false
	},
	{
		value: 'AbsoluteEpisodeNumber',
		label: 'Absolute Episodennummer',
		description: 'Verwendet die Episodennummer als absoluten Zähler (z.B. Episode 4524)',
		requiresSeasonRegex: false,
		requiresEpisodeRegex: true,
		requiresTitleRules: false
	},
	{
		value: 'ItemTitleIncludes',
		label: 'Titel enthält',
		description: 'Der konstruierte Titel ist Teil des TVDB-Episodennamens',
		requiresSeasonRegex: false,
		requiresEpisodeRegex: false,
		requiresTitleRules: true
	},
	{
		value: 'ItemTitleExact',
		label: 'Titel exakt',
		description: 'Der konstruierte Titel entspricht exakt dem TVDB-Episodennamen',
		requiresSeasonRegex: false,
		requiresEpisodeRegex: false,
		requiresTitleRules: true
	},
	{
		value: 'ItemTitleEqualsAirdate',
		label: 'Titel als Ausstrahlungsdatum',
		description: 'Der konstruierte Titel wird als Datum geparst und mit dem Ausstrahlungsdatum abgeglichen',
		requiresSeasonRegex: false,
		requiresEpisodeRegex: false,
		requiresTitleRules: true
	}
];

// Complete ruleset structure
export interface Ruleset {
	id?: number;
	/** Media ID this ruleset belongs to */
	mediaId?: number;
	/** Pipe-separated topic names (e.g., "Tatort|Polizeiruf 110") */
	topic: string;
	/** TVDB show ID */
	tvdbId?: number;
	/** Lower number = higher priority, first match wins */
	priority: number;
	/** Filters to narrow down API results */
	filters: Filter[];
	/** Rules for constructing the match title */
	titleRegexRules: RegexRule[];
	/** How to match against TVDB episodes */
	matchingStrategy: MatchingStrategy;
	/** Regex for extracting season number (or static like "S01") */
	seasonRegex?: string;
	/** Regex for extracting episode number (or static like "E05") */
	episodeRegex?: string;
	/** Associated media info (from API join) */
	media?: { name: string; tvdbId: number | null };
	/** Metadata */
	createdAt?: string;
	updatedAt?: string;
	createdBy?: string;
}

// Predefined patterns (admin-configurable)
export interface PredefinedTitlePattern {
	id: number;
	name: string;
	pattern: string;
	description?: string;
	sortOrder: number;
	isActive: boolean;
}

export interface PredefinedSeasonEpisodePattern {
	id: number;
	name: string;
	seasonPattern?: string;
	episodePattern?: string;
	description?: string;
	sortOrder: number;
	isActive: boolean;
}

// Changelog entry for versioning
export interface RulesetChangelogEntry {
	id: number;
	rulesetId: number;
	changedBy: string;
	changedAt: string;
	changeSummary: string;
}

// API response wrapper
export interface RulesetApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface RulesetListResponse {
	rulesets: Ruleset[];
	total: number;
	page: number;
	pageSize: number;
}
