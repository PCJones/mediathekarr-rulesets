/**
 * Suggestions API Service
 * Community proposals: list, detail, revisions, comments, votes, lifecycle.
 */

import type { Ruleset } from '$types/ruleset';
import type {
	MediaSuggestions,
	RulesetBody,
	RulesetBodySource,
	StaleEntry,
	SuggestionComment,
	SuggestionDetail,
	SuggestionInput,
	SuggestionListResponse,
	SuggestionRevision,
	SuggestionRuleset,
	SuggestionStatus,
	VoteResult
} from '$types/suggestion';
import { apiRequest, ApiError } from './client';

export type SuggestionSort = 'newest' | 'votes' | 'updated';

export interface SuggestionListParams {
	status?: SuggestionStatus[] | SuggestionStatus;
	mediaId?: number;
	author?: string;
	sort?: SuggestionSort;
	page?: number;
	pageSize?: number;
}

// ============ Conversions ============

/** Reduce any ruleset shape to the six body fields the bundle stores. */
export function toRulesetBody(source: RulesetBodySource): RulesetBody {
	return {
		topic: source.topic,
		matchingStrategy: source.matchingStrategy,
		filters: source.filters ?? [],
		titleRegexRules: source.titleRegexRules ?? [],
		seasonRegex: source.seasonRegex || null,
		episodeRegex: source.episodeRegex || null
	};
}

/** The `base.ruleset` shape sent on staging — a live ruleset without `media`. */
export function toBaseRuleset(ruleset: Ruleset): SuggestionRuleset {
	return {
		id: ruleset.id ?? 0,
		mediaId: ruleset.mediaId ?? null,
		priority: ruleset.priority,
		...toRulesetBody(ruleset)
	};
}

/** Turn a bundle ruleset back into the app-wide `Ruleset` shape. */
export function toRuleset(source: SuggestionRuleset): Ruleset;
export function toRuleset(source: RulesetBody, extra: { id?: number; mediaId?: number; priority: number }): Ruleset;
export function toRuleset(
	source: SuggestionRuleset | RulesetBody,
	extra?: { id?: number; mediaId?: number; priority: number }
): Ruleset {
	const full = source as SuggestionRuleset;
	return {
		id: extra ? extra.id : full.id,
		mediaId: extra ? extra.mediaId : (full.mediaId ?? undefined),
		priority: extra ? extra.priority : full.priority,
		topic: source.topic,
		matchingStrategy: source.matchingStrategy,
		filters: source.filters ?? [],
		titleRegexRules: source.titleRegexRules ?? [],
		seasonRegex: source.seasonRegex ?? undefined,
		episodeRegex: source.episodeRegex ?? undefined
	};
}

/** Stale entries carried by a 409 response, or null for any other failure. */
export function getStaleFromError(error: unknown): StaleEntry[] | null {
	if (!(error instanceof ApiError) || error.status !== 409) return null;
	const stale = (error.data as { stale?: unknown } | null)?.stale;
	return Array.isArray(stale) ? (stale as StaleEntry[]) : null;
}

export function isRevisionChangedError(error: unknown): boolean {
	return (
		error instanceof ApiError &&
		error.status === 409 &&
		(error.data as { revisionChanged?: unknown } | null)?.revisionChanged === true
	);
}

// ============ Reads ============

export async function getSuggestions(
	params: SuggestionListParams = {}
): Promise<SuggestionListResponse> {
	const query = new URLSearchParams();
	if (params.status) {
		const status = Array.isArray(params.status) ? params.status.join(',') : params.status;
		if (status) query.set('status', status);
	}
	if (params.mediaId != null) query.set('mediaId', String(params.mediaId));
	if (params.author) query.set('author', params.author);
	if (params.sort) query.set('sort', params.sort);
	if (params.page != null) query.set('page', String(params.page));
	if (params.pageSize != null) query.set('pageSize', String(params.pageSize));

	const qs = query.toString();
	return apiRequest<SuggestionListResponse>(`/suggestions${qs ? `?${qs}` : ''}`);
}

export async function getSuggestion(id: number): Promise<SuggestionDetail> {
	return apiRequest<SuggestionDetail>(`/suggestions/${id}`);
}

export async function getSuggestionRevision(
	id: number,
	number: number
): Promise<SuggestionRevision> {
	return apiRequest<SuggestionRevision>(`/suggestions/${id}/revisions/${number}`);
}

export async function getSuggestionsForMedia(mediaId: number): Promise<MediaSuggestions> {
	return apiRequest<MediaSuggestions>(`/suggestions/media/${mediaId}`);
}

// ============ Lifecycle ============

export async function createSuggestion(input: SuggestionInput): Promise<SuggestionDetail> {
	return apiRequest<SuggestionDetail>('/suggestions', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export async function reviseSuggestion(
	id: number,
	input: { revision: number; description: string; bundle: SuggestionInput['bundle']; mediaId?: number }
): Promise<SuggestionDetail> {
	return apiRequest<SuggestionDetail>(`/suggestions/${id}`, {
		method: 'PUT',
		body: JSON.stringify(input)
	});
}

export async function withdrawSuggestion(id: number): Promise<SuggestionDetail> {
	// the endpoint parses its body, so an empty POST would be rejected as invalid JSON
	return apiRequest<SuggestionDetail>(`/suggestions/${id}/withdraw`, {
		method: 'POST',
		body: JSON.stringify({})
	});
}

export async function rejectSuggestion(id: number, comment: string): Promise<SuggestionDetail> {
	return apiRequest<SuggestionDetail>(`/suggestions/${id}/reject`, {
		method: 'POST',
		body: JSON.stringify({ comment })
	});
}

export async function acceptSuggestion(
	id: number,
	revision: number,
	comment?: string
): Promise<SuggestionDetail> {
	return apiRequest<SuggestionDetail>(`/suggestions/${id}/accept`, {
		method: 'POST',
		body: JSON.stringify(comment ? { revision, comment } : { revision })
	});
}

// ============ Votes ============

export async function voteSuggestion(id: number): Promise<VoteResult> {
	return apiRequest<VoteResult>(`/suggestions/${id}/vote`, { method: 'PUT' });
}

export async function unvoteSuggestion(id: number): Promise<VoteResult> {
	return apiRequest<VoteResult>(`/suggestions/${id}/vote`, { method: 'DELETE' });
}

// ============ Comments ============

export async function getComments(id: number): Promise<SuggestionComment[]> {
	return apiRequest<SuggestionComment[]>(`/suggestions/${id}/comments`);
}

export async function addComment(id: number, content: string): Promise<SuggestionComment> {
	return apiRequest<SuggestionComment>(`/suggestions/${id}/comments`, {
		method: 'POST',
		body: JSON.stringify({ content })
	});
}

export async function editComment(
	id: number,
	commentId: number,
	content: string
): Promise<SuggestionComment> {
	return apiRequest<SuggestionComment>(`/suggestions/${id}/comments/${commentId}`, {
		method: 'PUT',
		body: JSON.stringify({ content })
	});
}

export async function deleteComment(id: number, commentId: number): Promise<void> {
	await apiRequest<unknown>(`/suggestions/${id}/comments/${commentId}`, { method: 'DELETE' });
}
