import type { Filter, Ruleset } from '$types';

export type Facet = 'topic' | 'strategy' | 'extraction' | 'titleRules' | 'filters';

const FACETS: Facet[] = ['topic', 'strategy', 'extraction', 'titleRules', 'filters'];

export const FACET_LABELS: Record<Facet, string> = {
	topic: 'Topic',
	strategy: 'Strategie',
	extraction: 'Staffel / Episode',
	titleRules: 'Titel-Regeln',
	filters: 'Filter'
};

const PATTERN_FACETS: Facet[] = ['extraction', 'titleRules'];

/**
 * Pattern columns get a real minimum: auto tracks grow to their max-content before fr tracks
 * get any free space, so a zero minimum starves the patterns. Two pattern columns share the
 * budget so the table still fits the container width it switches on at (see rulesetTableDensity).
 */
const SINGLE_PATTERN_TRACK = 'minmax(12rem, 1fr)';
const SHARED_PATTERN_TRACK = 'minmax(8rem, 1fr)';

const TEXT_TRACKS: Record<Exclude<Facet, 'extraction' | 'titleRules'>, string> = {
	topic: 'auto',
	strategy: 'auto',
	filters: 'fit-content(12rem)'
};

/** Bar (7rem) + count (5rem) + gap; longer shadow reasons wrap below. */
const COVERAGE_TRACK = 'fit-content(13rem)';
/** Badges and the discard button stack instead of widening the row. */
const ACTIONS_TRACK = 'fit-content(10rem)';

function facetKey(ruleset: Ruleset, facet: Facet): string {
	switch (facet) {
		case 'topic':
			return ruleset.topic ?? '';
		case 'strategy':
			return ruleset.matchingStrategy ?? '';
		case 'extraction':
			return ruleset.seasonRegex || ruleset.episodeRegex
				? JSON.stringify([ruleset.seasonRegex ?? '', ruleset.episodeRegex ?? ''])
				: '';
		case 'titleRules':
			return ruleset.titleRegexRules?.length ? JSON.stringify(ruleset.titleRegexRules) : '';
		case 'filters':
			return ruleset.filters?.length ? JSON.stringify(ruleset.filters) : '';
	}
}

/** Facets equal across all rulesets are `shared`; the rest are shown per row. Empty facets are dropped, except filters. */
export function splitFacets(rulesets: Ruleset[]): { shared: Facet[]; varying: Facet[] } {
	const shared: Facet[] = [];
	const varying: Facet[] = [];
	for (const facet of FACETS) {
		const keys = rulesets.map((r) => facetKey(r, facet));
		if (facet !== 'filters' && keys.every((k) => k === '')) continue;
		if (rulesets.length > 1 && keys.every((k) => k === keys[0])) shared.push(facet);
		else varying.push(facet);
	}
	return { shared, varying };
}

export function gridColumns(varying: Facet[]): string {
	const patternCount = varying.filter((facet) => PATTERN_FACETS.includes(facet)).length;
	const patternTrack = patternCount > 1 ? SHARED_PATTERN_TRACK : SINGLE_PATTERN_TRACK;
	const tracks = varying.length
		? varying.map((facet) =>
				facet === 'extraction' || facet === 'titleRules' ? patternTrack : TEXT_TRACKS[facet]
			)
		: ['minmax(0, 1fr)'];
	const actionsTrack = tracks.some((track) => track.includes('fr')) ? ACTIONS_TRACK : 'minmax(0, 1fr)';
	return ['auto', ...tracks, COVERAGE_TRACK, actionsTrack, 'auto'].join(' ');
}

/**
 * Picks the container width at which the list becomes a table (`ruleset-table:` variant in
 * app.css): 64rem fits one pattern column plus one text facet, anything more needs 72rem.
 */
export function rulesetTableDensity(varying: Facet[]): 'normal' | 'dense' {
	const patternCount = varying.filter((facet) => PATTERN_FACETS.includes(facet)).length;
	const textCount = varying.length - patternCount;
	return patternCount <= 1 && textCount <= 1 ? 'normal' : 'dense';
}

export interface PatternPart {
	text: string;
	group: boolean;
}

/**
 * Splits a regex at its top-level groups. Capture groups are flagged `group`; lookarounds and
 * non-capturing groups become their own plain parts so the pattern can wrap between tokens.
 */
export function splitCaptureGroups(pattern: string): PatternPart[] {
	const parts: PatternPart[] = [];
	let buffer = '';
	let depth = 0;
	let inClass = false;
	let isCapturing = false;
	const flush = (group: boolean) => {
		if (buffer) parts.push({ text: buffer, group });
		buffer = '';
	};

	for (let i = 0; i < pattern.length; i++) {
		const c = pattern[i];
		if (c === '\\') {
			buffer += c + (pattern[i + 1] ?? '');
			i++;
		} else if (inClass) {
			buffer += c;
			if (c === ']') inClass = false;
		} else if (c === '[') {
			inClass = true;
			buffer += c;
		} else if (c === '(' && depth === 0) {
			flush(false);
			depth = 1;
			isCapturing = pattern[i + 1] !== '?';
			buffer += c;
		} else if (c === '(' && depth > 0) {
			depth++;
			buffer += c;
		} else if (c === ')' && depth > 0) {
			depth--;
			buffer += c;
			if (depth === 0) flush(isCapturing);
		} else {
			buffer += c;
		}
	}
	flush(depth > 0 && isCapturing);
	return parts;
}

const FILTER_OPS: Record<string, string> = {
	GreaterThan: '>',
	LessThan: '<',
	Equals: '=',
	Contains: 'enthält',
	Regex: '~'
};

const FILTER_ATTRS: Record<string, string> = {
	channel: 'Sender',
	title: 'Titel',
	topic: 'Topic',
	description: 'Beschreibung'
};

export function formatFilter(filter: Filter): string {
	const op = FILTER_OPS[filter.type] ?? filter.type;
	if (filter.attribute === 'duration') return `${op} ${filter.value} min`;
	return `${FILTER_ATTRS[filter.attribute] ?? filter.attribute} ${op} „${filter.value}“`;
}
