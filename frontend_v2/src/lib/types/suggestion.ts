/**
 * Suggestion Types
 * GitHub issue-style proposal system
 */

import type { Ruleset } from './ruleset';
import type { Media } from './media';

export type SuggestionStatus = 'open' | 'accepted' | 'rejected';

export interface SuggestionTestResults {
	totalItems: number;
	matchedItems: number;
	matchRate: number;
	sampleMatches: Array<{
		title: string;
		constructedTitle: string;
		tvdbEpisode: string | null;
	}>;
}

export interface Comment {
	id: number;
	suggestionId: number;
	author: string;
	content: string;
	createdAt: string;
}

export interface Vote {
	userId: string;
	direction: 'up' | 'down';
}

export interface Suggestion {
	id: number;
	title: string;
	description: string;
	status: SuggestionStatus;
	author: string;
	createdAt: string;
	updatedAt: string;
	/** The proposed ruleset configuration */
	proposedRuleset: Omit<Ruleset, 'id'>;
	/** Media this suggestion targets */
	media: Media;
	/** Test results from when the suggestion was created */
	testResults: SuggestionTestResults;
	/** Vote tallies */
	votes: Vote[];
	/** Discussion comments */
	comments: Comment[];
	/** Admin who accepted/rejected (if applicable) */
	resolvedBy?: string;
	/** Reason for acceptance/rejection */
	resolutionComment?: string;
}
