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

const FACET_TRACKS: Record<Facet, string> = {
	topic: 'auto',
	strategy: 'auto',
	extraction: 'minmax(0, 1fr)',
	titleRules: 'minmax(0, 1fr)',
	filters: 'auto'
};

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
	const tracks = varying.length ? varying.map((f) => FACET_TRACKS[f]) : ['minmax(0, 1fr)'];
	const meta = tracks.some((t) => t.includes('fr')) ? 'auto' : 'minmax(0, 1fr)';
	return ['auto', ...tracks, 'auto', meta, 'auto'].join(' ');
}

export interface PatternPart {
	text: string;
	group: boolean;
}

/** Splits a regex into plain text and top-level capture groups. */
export function splitCaptureGroups(pattern: string): PatternPart[] {
	const parts: PatternPart[] = [];
	let buffer = '';
	let depth = 0;
	let inClass = false;
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
		} else if (c === '(' && depth === 0 && pattern[i + 1] !== '?') {
			flush(false);
			depth = 1;
			buffer += c;
		} else if (c === '(' && depth > 0) {
			depth++;
			buffer += c;
		} else if (c === ')' && depth > 0) {
			depth--;
			buffer += c;
			if (depth === 0) flush(true);
		} else {
			buffer += c;
		}
	}
	flush(depth > 0);
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
