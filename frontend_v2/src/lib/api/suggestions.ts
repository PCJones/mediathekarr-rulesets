/**
 * Suggestions API Service
 * Dummy data module simulating a suggestions API
 * In-memory vote/comment operations
 */

import type { Suggestion, Comment, Vote, SuggestionStatus } from '$types/suggestion';

// Hardcoded dummy suggestions
let suggestions: Suggestion[] = [
	{
		id: 1,
		title: 'Ruleset für Tatort mit Jahres-Staffeln',
		description: 'Tatort verwendet auf TVDB das Jahr als Staffelnummer. Dieses Ruleset extrahiert das Ausstrahlungsdatum und matcht über die Airdate-Strategie.',
		status: 'open',
		author: 'max.mustermann',
		createdAt: '2026-01-15T10:30:00Z',
		updatedAt: '2026-01-15T10:30:00Z',
		proposedRuleset: {
			topic: 'Tatort',
			tvdbId: 83214,
			priority: 0,
			filters: [
				{ attribute: 'duration', type: 'GreaterThan', value: '45' }
			],
			titleRegexRules: [
				{ type: 'regex', field: 'title', pattern: '^(.+?)\\s*\\(' }
			],
			matchingStrategy: 'ItemTitleEqualsAirdate',
			seasonRegex: '',
			episodeRegex: ''
		},
		media: { id: 1, name: 'Tatort', type: 'show', tvdbId: 83214 },
		testResults: {
			totalItems: 156,
			matchedItems: 142,
			matchRate: 91.0,
			sampleMatches: [
				{ title: 'Tatort: Borowski und das ewige Meer', constructedTitle: 'Borowski und das ewige Meer', tvdbEpisode: 'S2024E01 - Borowski und das ewige Meer' },
				{ title: 'Tatort: Der Fall Holdt', constructedTitle: 'Der Fall Holdt', tvdbEpisode: 'S2024E03 - Der Fall Holdt' },
				{ title: 'Tatort: Murot und das Paradies', constructedTitle: 'Murot und das Paradies', tvdbEpisode: null }
			]
		},
		votes: [
			{ userId: 'user1', direction: 'up' },
			{ userId: 'user2', direction: 'up' },
			{ userId: 'user3', direction: 'up' }
		],
		comments: [
			{
				id: 1,
				suggestionId: 1,
				author: 'admin',
				content: 'Sieht gut aus, die Match-Rate ist hoch. Muss noch geprüft werden ob alle Sondersendungen korrekt erkannt werden.',
				createdAt: '2026-01-16T08:00:00Z'
			}
		]
	},
	{
		id: 2,
		title: 'Der Bergdoktor S+E Matching',
		description: 'Klassisches Season+Episode Matching für Der Bergdoktor. Extrahiert Staffel und Episode aus dem Titel-Format "S19/E03".',
		status: 'accepted',
		author: 'anna.schmidt',
		createdAt: '2026-01-10T14:00:00Z',
		updatedAt: '2026-01-12T09:00:00Z',
		proposedRuleset: {
			topic: 'Der Bergdoktor',
			tvdbId: 80495,
			priority: 0,
			filters: [
				{ attribute: 'duration', type: 'GreaterThan', value: '40' }
			],
			titleRegexRules: [],
			matchingStrategy: 'SeasonAndEpisodeNumber',
			seasonRegex: 'S(\\d+)',
			episodeRegex: 'E(\\d+)'
		},
		media: { id: 2, name: 'Der Bergdoktor', type: 'show', tvdbId: 80495 },
		testResults: {
			totalItems: 89,
			matchedItems: 85,
			matchRate: 95.5,
			sampleMatches: [
				{ title: 'Der Bergdoktor (S19/E03)', constructedTitle: 'Der Bergdoktor (S19/E03)', tvdbEpisode: 'S19E03 - Familienbande' },
				{ title: 'Der Bergdoktor (S19/E04)', constructedTitle: 'Der Bergdoktor (S19/E04)', tvdbEpisode: 'S19E04 - Neue Wege' }
			]
		},
		votes: [
			{ userId: 'user1', direction: 'up' },
			{ userId: 'user2', direction: 'up' },
			{ userId: 'user4', direction: 'up' },
			{ userId: 'user5', direction: 'up' }
		],
		comments: [
			{
				id: 2,
				suggestionId: 2,
				author: 'anna.schmidt',
				content: 'Funktioniert sehr zuverlässig für die letzten 3 Staffeln.',
				createdAt: '2026-01-10T14:05:00Z'
			},
			{
				id: 3,
				suggestionId: 2,
				author: 'admin',
				content: 'Angenommen! Ruleset wurde erstellt.',
				createdAt: '2026-01-12T09:00:00Z'
			}
		],
		resolvedBy: 'admin',
		resolutionComment: 'Exzellente Match-Rate, Ruleset übernommen.'
	},
	{
		id: 3,
		title: 'Sturm der Liebe - Absolute Episode',
		description: 'Sturm der Liebe hat über 4000 Episoden und verwendet absolute Episodennummern auf TVDB.',
		status: 'open',
		author: 'peter.mueller',
		createdAt: '2026-02-01T11:00:00Z',
		updatedAt: '2026-02-01T11:00:00Z',
		proposedRuleset: {
			topic: 'Sturm der Liebe',
			tvdbId: 79604,
			priority: 0,
			filters: [
				{ attribute: 'duration', type: 'GreaterThan', value: '35' }
			],
			titleRegexRules: [],
			matchingStrategy: 'AbsoluteEpisodeNumber',
			seasonRegex: '',
			episodeRegex: '(\\d{4})'
		},
		media: { id: 3, name: 'Sturm der Liebe', type: 'show', tvdbId: 79604 },
		testResults: {
			totalItems: 245,
			matchedItems: 210,
			matchRate: 85.7,
			sampleMatches: [
				{ title: 'Sturm der Liebe (4523)', constructedTitle: 'Sturm der Liebe (4523)', tvdbEpisode: 'Episode 4523' },
				{ title: 'Sturm der Liebe (4524)', constructedTitle: 'Sturm der Liebe (4524)', tvdbEpisode: 'Episode 4524' }
			]
		},
		votes: [
			{ userId: 'user2', direction: 'up' },
			{ userId: 'user3', direction: 'down' }
		],
		comments: []
	},
	{
		id: 4,
		title: 'SOKO München Titel-Matching',
		description: 'SOKO München: Konstruiert den Episodentitel aus dem MediathekViewWeb-Titel und matcht per Includes gegen TVDB.',
		status: 'rejected',
		author: 'lisa.weber',
		createdAt: '2025-12-20T16:00:00Z',
		updatedAt: '2025-12-22T10:00:00Z',
		proposedRuleset: {
			topic: 'SOKO München',
			tvdbId: 79612,
			priority: 0,
			filters: [
				{ attribute: 'duration', type: 'GreaterThan', value: '40' }
			],
			titleRegexRules: [
				{ type: 'regex', field: 'title', pattern: '^SOKO München:\\s*(.+)$' }
			],
			matchingStrategy: 'ItemTitleIncludes',
			seasonRegex: '',
			episodeRegex: ''
		},
		media: { id: 4, name: 'SOKO München', type: 'show', tvdbId: 79612 },
		testResults: {
			totalItems: 67,
			matchedItems: 28,
			matchRate: 41.8,
			sampleMatches: [
				{ title: 'SOKO München: Tödliche Wahrheit', constructedTitle: 'Tödliche Wahrheit', tvdbEpisode: 'Tödliche Wahrheit' },
				{ title: 'SOKO München: Der letzte Zeuge', constructedTitle: 'Der letzte Zeuge', tvdbEpisode: null }
			]
		},
		votes: [
			{ userId: 'user1', direction: 'down' }
		],
		comments: [
			{
				id: 4,
				suggestionId: 4,
				author: 'admin',
				content: 'Match-Rate zu niedrig (41.8%). Die TVDB-Episodennamen weichen häufig ab. Bitte mit S+E Matching versuchen.',
				createdAt: '2025-12-22T10:00:00Z'
			}
		],
		resolvedBy: 'admin',
		resolutionComment: 'Match-Rate zu niedrig, Titel-Matching funktioniert hier nicht zuverlässig.'
	},
	{
		id: 5,
		title: 'Bares für Rares - Datumsbasiert',
		description: 'Bares für Rares erscheint täglich. Matching über das Ausstrahlungsdatum, das im Titel enthalten ist.',
		status: 'open',
		author: 'thomas.fischer',
		createdAt: '2026-02-10T09:00:00Z',
		updatedAt: '2026-02-10T09:00:00Z',
		proposedRuleset: {
			topic: 'Bares für Rares',
			tvdbId: 287556,
			priority: 0,
			filters: [
				{ attribute: 'duration', type: 'GreaterThan', value: '30' },
				{ attribute: 'title', type: 'Contains', value: 'Bares für Rares' }
			],
			titleRegexRules: [
				{ type: 'regex', field: 'title', pattern: '(\\d{2}\\.\\d{2}\\.\\d{4})' }
			],
			matchingStrategy: 'ItemTitleEqualsAirdate',
			seasonRegex: '',
			episodeRegex: ''
		},
		media: { id: 5, name: 'Bares für Rares', type: 'show', tvdbId: 287556 },
		testResults: {
			totalItems: 312,
			matchedItems: 289,
			matchRate: 92.6,
			sampleMatches: [
				{ title: 'Bares für Rares vom 15.01.2026', constructedTitle: '15.01.2026', tvdbEpisode: 'S2026E12 - Episode 12' },
				{ title: 'Bares für Rares vom 16.01.2026', constructedTitle: '16.01.2026', tvdbEpisode: 'S2026E13 - Episode 13' }
			]
		},
		votes: [
			{ userId: 'user1', direction: 'up' },
			{ userId: 'user2', direction: 'up' },
			{ userId: 'user5', direction: 'up' },
			{ userId: 'user6', direction: 'up' },
			{ userId: 'user7', direction: 'up' }
		],
		comments: [
			{
				id: 5,
				suggestionId: 5,
				author: 'thomas.fischer',
				content: 'Funktioniert stabil, auch für Sondersendungen.',
				createdAt: '2026-02-10T09:05:00Z'
			}
		]
	}
];

let nextCommentId = 6;

/**
 * Get all suggestions, optionally filtered by status
 */
export function getSuggestions(status?: SuggestionStatus): Suggestion[] {
	if (status) {
		return suggestions.filter(s => s.status === status);
	}
	return [...suggestions];
}

/**
 * Get a single suggestion by ID
 */
export function getSuggestion(id: number): Suggestion | null {
	return suggestions.find(s => s.id === id) || null;
}

/**
 * Add a vote to a suggestion
 */
export function addVote(suggestionId: number, userId: string, direction: 'up' | 'down'): void {
	const suggestion = suggestions.find(s => s.id === suggestionId);
	if (!suggestion) return;

	// Remove existing vote from this user
	suggestion.votes = suggestion.votes.filter(v => v.userId !== userId);
	// Add new vote
	suggestion.votes.push({ userId, direction });
}

/**
 * Remove a vote from a suggestion
 */
export function removeVote(suggestionId: number, userId: string): void {
	const suggestion = suggestions.find(s => s.id === suggestionId);
	if (!suggestion) return;

	suggestion.votes = suggestion.votes.filter(v => v.userId !== userId);
}

/**
 * Add a comment to a suggestion
 */
export function addComment(suggestionId: number, author: string, content: string): Comment {
	const suggestion = suggestions.find(s => s.id === suggestionId);
	if (!suggestion) throw new Error('Vorschlag nicht gefunden');

	const comment: Comment = {
		id: nextCommentId++,
		suggestionId,
		author,
		content,
		createdAt: new Date().toISOString()
	};

	suggestion.comments.push(comment);
	suggestion.updatedAt = comment.createdAt;
	return comment;
}

/**
 * Update suggestion status (admin action)
 */
export function updateSuggestionStatus(
	suggestionId: number,
	status: SuggestionStatus,
	resolvedBy: string,
	resolutionComment?: string
): void {
	const suggestion = suggestions.find(s => s.id === suggestionId);
	if (!suggestion) throw new Error('Vorschlag nicht gefunden');

	suggestion.status = status;
	suggestion.resolvedBy = resolvedBy;
	suggestion.resolutionComment = resolutionComment;
	suggestion.updatedAt = new Date().toISOString();
}

/**
 * Get vote score for a suggestion
 */
export function getVoteScore(suggestion: Suggestion): number {
	return suggestion.votes.reduce((score, vote) => {
		return score + (vote.direction === 'up' ? 1 : -1);
	}, 0);
}
