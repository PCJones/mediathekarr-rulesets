/**
 * Pure coverage evaluation.
 * The full matching pipeline (topic → skip → filters → title → TVDB) without
 * store state, so drafts, snapshots and the coverage store share one evaluator.
 */

import type { MediathekItem, Ruleset, TvdbEpisode } from '$types';
import type {
	BundleCoverage,
	ChangeSnapshot,
	CoverageCounts,
	SampleRow,
	SuggestionChange
} from '$types/suggestion';
import { evaluateFilters, checkSkipKeywords, buildTitleFromRules } from './regex';
import { matchEpisodeByStrategy, type TvdbMatchResult } from './tvdbMatcher';
import { queryByTopic } from '$api/mediathekview';

export type MatchStage = 'ok' | 'topic' | 'skip' | 'filter' | 'title' | 'tvdb';

export interface CoverageResult {
	/** item id → id of the ruleset that claims it (lowest priority number wins) */
	claimedBy: Map<string, number>;
	/** ruleset id → number of items it claims */
	perRuleset: Map<number, number>;
	coveredByAny: number;
	gaps: number;
}

/** Pipe-separated topics, trimmed and lowercased — the form used for lookups. */
export function splitTopics(topic: string): string[] {
	return topic
		.split('|')
		.map((t) => t.trim().toLowerCase())
		.filter((t) => t.length > 0);
}

/** Exact, case-sensitive topic match, mirroring the backend's per-topic lookup. */
export function matchesTopic(itemTopic: string, rulesetTopic: string): boolean {
	return rulesetTopic
		.split('|')
		.map((t) => t.trim())
		.some((t) => t.length > 0 && t === itemTopic);
}

/** Which pipeline stage an item fails on, or `ok` when it matches fully. */
export function matchStage(
	item: MediathekItem,
	ruleset: Ruleset,
	tvdbEpisodes: TvdbEpisode[]
): MatchStage {
	return evaluateItem(item, ruleset, tvdbEpisodes).stage;
}

function evaluateItem(
	item: MediathekItem,
	ruleset: Ruleset,
	tvdbEpisodes: TvdbEpisode[]
): { stage: MatchStage; tvdb?: TvdbMatchResult } {
	if (!matchesTopic(item.topic, ruleset.topic)) return { stage: 'topic' };

	if (checkSkipKeywords(item.title) !== null) return { stage: 'skip' };

	if (ruleset.filters.length > 0) {
		const results = evaluateFilters(item, ruleset.filters);
		if (!results.every((r) => r.passed)) return { stage: 'filter' };
	}

	if (ruleset.titleRegexRules.length > 0) {
		const { finalTitle } = buildTitleFromRules(item, ruleset.titleRegexRules);
		if (finalTitle === null) return { stage: 'title' };
	}

	if (tvdbEpisodes.length > 0) {
		const tvdb = matchEpisodeByStrategy(
			item,
			tvdbEpisodes,
			ruleset.matchingStrategy,
			ruleset.titleRegexRules,
			ruleset.seasonRegex,
			ruleset.episodeRegex
		);
		return { stage: tvdb.matched ? 'ok' : 'tvdb', tvdb };
	}

	return { stage: 'ok' };
}

export interface RulesetEpisodeCoverage {
	/** Distinct episodes first recognised by this ruleset. */
	found: number;
	/** Distinct extracted values with no TVDB episode. */
	unknown: number;
	/** Episodes this ruleset also recognises, keyed by the earlier ruleset's id. */
	shadowedBy: Map<number, number>;
}

/**
 * Coverage counted in distinct episodes, not Mediathek items.
 * Each episode belongs to the first ruleset (in list order) that recognises it.
 * Without TVDB data every matching item counts as its own episode.
 */
export function computeEpisodeCoverage(
	items: MediathekItem[],
	orderedRulesets: Ruleset[],
	tvdbEpisodes: TvdbEpisode[]
): { perRuleset: Map<number, RulesetEpisodeCoverage>; total: number } {
	const owner = new Map<string, number>();
	const perRuleset = new Map<number, RulesetEpisodeCoverage>();

	orderedRulesets.forEach((ruleset, index) => {
		const id = ruleset.id ?? -(1000 + index);
		const episodes = new Set<string>();
		const unknown = new Set<string>();

		for (const item of items) {
			let evaluated: ReturnType<typeof evaluateItem>;
			try {
				evaluated = evaluateItem(item, ruleset, tvdbEpisodes);
			} catch {
				continue;
			}
			const { stage, tvdb } = evaluated;
			if (stage === 'ok') {
				const episode = tvdb?.episode;
				episodes.add(
					episode
						? `ep:${episode.id ?? `${episode.seasonNumber}x${episode.episodeNumber}`}`
						: `item:${item.id}`
				);
			} else if (stage === 'tvdb' && tvdb && !tvdb.error && tvdb.matchDetails.searchedValue) {
				unknown.add(tvdb.matchDetails.searchedValue);
			}
		}

		const coverage: RulesetEpisodeCoverage = { found: 0, unknown: unknown.size, shadowedBy: new Map() };
		for (const key of episodes) {
			const earlier = owner.get(key);
			if (earlier === undefined) {
				owner.set(key, id);
				coverage.found++;
			} else {
				coverage.shadowedBy.set(earlier, (coverage.shadowedBy.get(earlier) ?? 0) + 1);
			}
		}
		perRuleset.set(id, coverage);
	});

	return { perRuleset, total: owner.size };
}

export function matchesRuleset(
	item: MediathekItem,
	ruleset: Ruleset,
	tvdbEpisodes: TvdbEpisode[]
): boolean {
	return matchStage(item, ruleset, tvdbEpisodes) === 'ok';
}

export function countMatches(
	items: MediathekItem[],
	ruleset: Ruleset,
	tvdbEpisodes: TvdbEpisode[]
): number {
	let count = 0;
	for (const item of items) {
		try {
			if (matchesRuleset(item, ruleset, tvdbEpisodes)) count++;
		} catch {
			// invalid regex — item stays unmatched
		}
	}
	return count;
}

/** Priority-aware coverage: the lowest-priority-number ruleset claims each item. */
export function computeCoverage(
	items: MediathekItem[],
	rulesets: Ruleset[],
	tvdbEpisodes: TvdbEpisode[]
): CoverageResult {
	const ordered = rulesets
		.map((ruleset, index) => ({ ruleset, id: ruleset.id ?? -(1000 + index) }))
		.sort((a, b) => a.ruleset.priority - b.ruleset.priority);

	const claimedBy = new Map<string, number>();
	const perRuleset = new Map<number, number>();

	for (const item of items) {
		for (const { ruleset, id } of ordered) {
			let matched = false;
			try {
				matched = matchesRuleset(item, ruleset, tvdbEpisodes);
			} catch {
				matched = false;
			}
			if (matched) {
				claimedBy.set(item.id, id);
				perRuleset.set(id, (perRuleset.get(id) ?? 0) + 1);
				break;
			}
		}
	}

	return {
		claimedBy,
		perRuleset,
		coveredByAny: claimedBy.size,
		gaps: items.length - claimedBy.size
	};
}

// ─── Snapshots ───────────────────────────────────────────────────

type SnapshotChange = Pick<SuggestionChange, 'op' | 'ruleset' | 'base'>;

const MAX_SAMPLES = 8;

function asRuleset(body: NonNullable<SuggestionChange['ruleset']>): Ruleset {
	return {
		topic: body.topic,
		matchingStrategy: body.matchingStrategy,
		filters: body.filters ?? [],
		titleRegexRules: body.titleRegexRules ?? [],
		seasonRegex: body.seasonRegex ?? undefined,
		episodeRegex: body.episodeRegex ?? undefined,
		priority: 0
	};
}

function formatEpisode(episode: { seasonNumber: number; episodeNumber: number; name: string }): string {
	const ep = String(episode.episodeNumber).padStart(2, '0');
	return `S${episode.seasonNumber}E${ep} – ${episode.name}`;
}

function buildSampleRow(
	item: MediathekItem,
	ruleset: Ruleset,
	tvdbEpisodes: TvdbEpisode[]
): SampleRow {
	let constructed: string | null = null;
	if (ruleset.titleRegexRules.length > 0) {
		constructed = buildTitleFromRules(item, ruleset.titleRegexRules).finalTitle;
	} else {
		constructed = item.title;
	}

	if (constructed === null) {
		return { title: item.title, constructed: null, episode: null, fail: 'title' };
	}

	if (tvdbEpisodes.length === 0) {
		return { title: item.title, constructed, episode: null };
	}

	const match = matchEpisodeByStrategy(
		item,
		tvdbEpisodes,
		ruleset.matchingStrategy,
		ruleset.titleRegexRules,
		ruleset.seasonRegex,
		ruleset.episodeRegex
	);

	if (!match.matched || !match.episode) {
		return { title: item.title, constructed, episode: null, fail: 'tvdb' };
	}

	return { title: item.title, constructed, episode: formatEpisode(match.episode) };
}

/**
 * First items in Mediathek order that pass the ruleset's filters, mixing
 * successes and failures so a reviewer sees both.
 */
function buildSamples(
	items: MediathekItem[],
	ruleset: Ruleset,
	tvdbEpisodes: TvdbEpisode[]
): SampleRow[] {
	const successes: Array<{ index: number; row: SampleRow }> = [];
	const failures: Array<{ index: number; row: SampleRow }> = [];

	for (let i = 0; i < items.length; i++) {
		let stage: MatchStage;
		try {
			stage = matchStage(items[i], ruleset, tvdbEpisodes);
		} catch {
			continue;
		}
		if (stage === 'topic' || stage === 'skip' || stage === 'filter') continue;

		let row: SampleRow;
		try {
			row = buildSampleRow(items[i], ruleset, tvdbEpisodes);
		} catch {
			continue;
		}
		(row.fail ? failures : successes).push({ index: i, row });

		if (successes.length >= MAX_SAMPLES && failures.length >= MAX_SAMPLES) break;
	}

	const half = Math.floor(MAX_SAMPLES / 2);
	const takeSuccess = Math.min(successes.length, Math.max(half, MAX_SAMPLES - failures.length));
	const picked = [
		...successes.slice(0, takeSuccess),
		...failures.slice(0, MAX_SAMPLES - takeSuccess)
	];

	return picked.sort((a, b) => a.index - b.index).map((p) => p.row);
}

function counts(
	matchedByThis: number | null,
	items: MediathekItem[],
	rulesets: Ruleset[],
	tvdbEpisodes: TvdbEpisode[]
): CoverageCounts {
	const coverage = computeCoverage(items, rulesets, tvdbEpisodes);
	return { matchedByThis, coveredByAny: coverage.coveredByAny, gaps: coverage.gaps };
}

/**
 * Before/after counts and sample rows for one staged change.
 * `matchedByThis` is null before a create and after a delete.
 */
export function getChangeSnapshot(
	change: SnapshotChange,
	items: MediathekItem[],
	liveRulesets: Ruleset[],
	effectiveRulesets: Ruleset[],
	tvdbEpisodes: TvdbEpisode[] = []
): ChangeSnapshot {
	const proposed = change.ruleset ? asRuleset(change.ruleset) : null;
	const base = change.base ? asRuleset(change.base.ruleset) : null;
	const evaluated = change.op === 'delete' ? base : proposed;

	const before =
		change.op === 'create' || !base
			? counts(null, items, liveRulesets, tvdbEpisodes)
			: counts(countMatches(items, base, tvdbEpisodes), items, liveRulesets, tvdbEpisodes);

	const after =
		change.op === 'delete' || !proposed
			? counts(null, items, effectiveRulesets, tvdbEpisodes)
			: counts(countMatches(items, proposed, tvdbEpisodes), items, effectiveRulesets, tvdbEpisodes);

	return {
		capturedAt: new Date().toISOString(),
		query: { topic: evaluated?.topic ?? '', items: items.length },
		before,
		after,
		samples: evaluated ? buildSamples(items, evaluated, tvdbEpisodes) : []
	};
}

/** Every item relevant to a (possibly pipe-separated) topic, deduped by id. */
export function collectItems(
	topic: string,
	itemsByTopic: Map<string, MediathekItem[]>
): MediathekItem[] {
	const seen = new Set<string>();
	const result: MediathekItem[] = [];
	for (const t of splitTopics(topic)) {
		for (const item of itemsByTopic.get(t) ?? []) {
			if (seen.has(item.id)) continue;
			seen.add(item.id);
			result.push(item);
		}
	}
	return result;
}

/** Bundle-level coverage over the union of every change's item set. */
export function computeBundleCoverage(
	changes: SnapshotChange[],
	itemsByTopic: Map<string, MediathekItem[]>,
	liveRulesets: Ruleset[],
	effectiveRulesets: Ruleset[],
	tvdbEpisodes: TvdbEpisode[] = []
): BundleCoverage {
	const seen = new Set<string>();
	const items: MediathekItem[] = [];

	for (const change of changes) {
		const topic = change.ruleset?.topic ?? change.base?.ruleset.topic ?? '';
		for (const item of collectItems(topic, itemsByTopic)) {
			if (seen.has(item.id)) continue;
			seen.add(item.id);
			items.push(item);
		}
	}

	const before = computeCoverage(items, liveRulesets, tvdbEpisodes);
	const after = computeCoverage(items, effectiveRulesets, tvdbEpisodes);

	return {
		capturedAt: new Date().toISOString(),
		items: items.length,
		before: { coveredByAny: before.coveredByAny, gaps: before.gaps },
		after: { coveredByAny: after.coveredByAny, gaps: after.gaps }
	};
}

/**
 * Fetch Mediathek items for every distinct topic (pipe-separated strings are
 * split first). Keys are trimmed lowercase topics; a failed topic yields [].
 */
export async function fetchItemsForTopics(
	topics: string[]
): Promise<Map<string, MediathekItem[]>> {
	const unique = new Map<string, string>();
	for (const raw of topics) {
		for (const part of raw.split('|')) {
			const trimmed = part.trim();
			if (trimmed) unique.set(trimmed.toLowerCase(), trimmed);
		}
	}

	const result = new Map<string, MediathekItem[]>();
	await Promise.all(
		[...unique].map(async ([key, topic]) => {
			try {
				result.set(key, await queryByTopic(topic));
			} catch {
				result.set(key, []);
			}
		})
	);

	return result;
}
