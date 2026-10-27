/**
 * Suggestion Types
 * Community proposals: bundles of ruleset changes with self-measured coverage.
 */

import type { Filter, RegexRule, MatchingStrategy, Ruleset } from './ruleset';
import type { MediaType } from './media';

export type SuggestionStatus = 'open' | 'accepted' | 'rejected' | 'withdrawn';
export type ChangeOp = 'create' | 'update' | 'delete';

/** The six fields the server keeps for a proposed ruleset. */
export interface RulesetBody {
	topic: string;
	matchingStrategy: MatchingStrategy;
	filters: Filter[];
	titleRegexRules: RegexRule[];
	seasonRegex: string | null;
	episodeRegex: string | null;
}

/** Live ruleset as embedded in `change.base` (server-normalised, `media` stripped). */
export interface SuggestionRuleset extends RulesetBody {
	id: number;
	mediaId: number | null;
	priority: number;
}

export interface CoverageCounts {
	matchedByThis: number | null;
	coveredByAny: number;
	gaps: number;
}

export type FailStage = 'title' | 'tvdb';

export interface SampleRow {
	title: string;
	constructed: string | null;
	episode: string | null;
	fail?: FailStage;
}

export interface ChangeSnapshot {
	capturedAt: string;
	query: { topic: string; items: number };
	before: CoverageCounts;
	after: CoverageCounts;
	samples: SampleRow[];
}

export interface BundleCoverage {
	capturedAt: string;
	items: number;
	before: { coveredByAny: number; gaps: number };
	after: { coveredByAny: number; gaps: number };
}

export interface SuggestionChange {
	key: string;
	op: ChangeOp;
	rulesetId?: number;
	base?: { hash?: string; ruleset: SuggestionRuleset };
	ruleset?: RulesetBody;
	snapshot: ChangeSnapshot | null;
}

export interface SuggestionBundle {
	changes: SuggestionChange[];
	order: string[] | null;
	coverage: BundleCoverage | null;
}

export interface ProposedMedia {
	name: string;
	type: MediaType;
	tvdbId?: number | null;
	imdbId?: string | null;
	tmdbId?: number | null;
}

export type StaleReason = 'ruleset_changed' | 'ruleset_missing' | 'media_missing' | 'media_exists';

export interface StaleEntry {
	key: string | null;
	reason: StaleReason;
}

export interface ChangeCounts {
	create: number;
	update: number;
	delete: number;
}

export interface SuggestionSummary {
	id: number;
	status: SuggestionStatus;
	media: { id: number; name: string; type: MediaType; tvdbId: number | null } | null;
	proposedMedia: ProposedMedia | null;
	author: { id: number; username: string };
	createdAt: string;
	updatedAt: string;
	currentRevision: number;
	changeCounts: ChangeCounts;
	touchedRulesetIds: number[];
	coverage: BundleCoverage | null;
	votes: number;
	hasVoted: boolean;
	comments: number;
	isStale: boolean;
}

export interface RevisionRef {
	number: number;
	author: string;
	createdAt: string;
	changeCounts: ChangeCounts;
}

export interface AppliedResult {
	mediaId: number;
	createdMediaId: number | null;
	created: Record<string, number>;
	updated: number[];
	deleted: number[];
	order: number[] | null;
}

export interface SuggestionDetail extends SuggestionSummary {
	description: string;
	bundle: SuggestionBundle;
	revisions: RevisionRef[];
	stale: StaleEntry[];
	resolvedBy?: string;
	resolvedAt?: string;
	resolutionComment?: string;
	appliedResult?: AppliedResult;
	forkedFromId?: number;
}

export interface SuggestionRevision {
	number: number;
	author: string;
	createdAt: string;
	description: string;
	bundle: SuggestionBundle;
}

export interface SuggestionComment {
	id: number;
	author: { id: number; username: string };
	content: string | null;
	createdAt: string;
	editedAt: string | null;
	deleted: boolean;
}

export interface SuggestionListResponse {
	suggestions: SuggestionSummary[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export interface MediaSuggestions {
	open: SuggestionSummary[];
	mine: SuggestionSummary | null;
}

export interface VoteResult {
	votes: number;
	hasVoted: boolean;
}

/** Payload accepted by POST /suggestions and PUT /suggestions/{id}. */
export interface SuggestionInput {
	mediaId?: number;
	proposedMedia?: ProposedMedia;
	description: string;
	bundle: SuggestionBundle;
	forkedFromId?: number;
}

/** Anything carrying the six body fields — a live `Ruleset` or a bundle body. */
export type RulesetBodySource = RulesetBody | Ruleset | SuggestionRuleset;
