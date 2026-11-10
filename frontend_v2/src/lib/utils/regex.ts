/**
 * Regex utilities for ruleset evaluation
 */

import type {
	RegexRule,
	Filter,
	MediathekItem,
	FilterCheckResult,
	TitleConstructionStep,
	SeasonEpisodeExtraction
} from '$types';

const LOOKBEHIND_ERROR =
	'Ein Lookbehind „(?<=…)“ darf keine beliebig lange Wiederholung wie * oder + enthalten. ' +
	'Tipp: Lookbehind weglassen und den gewünschten Teil in Klammern setzen, z. B. „Tatort:\\s*(.+)“ statt „(?<=Tatort:\\s*).+“.';

// Same wording as the API (ruleset_validation.php)
const REGEX_ERROR_HINTS: [RegExp, string][] = [
	[/Unterminated group/, 'Es fehlt eine schließende Klammer „)“.'],
	[/Unmatched '\)'/, 'Es gibt eine schließende Klammer „)“ zu viel.'],
	[/Unterminated character class/, 'Es fehlt eine schließende eckige Klammer „]“.'],
	[/Nothing to repeat/, 'Ein Wiederholungszeichen (*, +, ? oder {…}) steht an einer Stelle, an der nichts wiederholt werden kann.'],
	[/\\ at end of pattern/, 'Das Muster endet mit einem einzelnen Backslash „\\“.'],
	[/Range out of order/, 'Ein Bereich in eckigen Klammern ist verdreht, z. B. „[z-a]“ statt „[a-z]“.'],
	[/numbers out of order/, 'In „{min,max}“ ist die erste Zahl größer als die zweite.']
];

/**
 * Whether a lookbehind contains an unbounded quantifier (*, +, {n,}).
 * JS and .NET accept this, but the API (PCRE) rejects it.
 */
export function hasUnboundedLookbehind(pattern: string): boolean {
	for (let i = 0; i < pattern.length; i++) {
		if (pattern[i] === '\\') {
			i++;
			continue;
		}
		if (!pattern.startsWith('(?<=', i) && !pattern.startsWith('(?<!', i)) continue;

		let depth = 1;
		let inClass = false;
		for (let j = i + 4; j < pattern.length && depth > 0; j++) {
			const c = pattern[j];
			if (c === '\\') {
				j++;
			} else if (inClass) {
				if (c === ']') inClass = false;
			} else if (c === '[') {
				inClass = true;
			} else if (c === '(') {
				depth++;
			} else if (c === ')') {
				depth--;
			} else if (c === '*' || c === '+' || (c === '{' && /^\{\d*,\}/.test(pattern.slice(j)))) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Validate a regex pattern, with user-friendly German error messages
 */
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
	try {
		new RegExp(pattern);
	} catch (e) {
		const detail = (e instanceof Error ? e.message : '').replace(/^Invalid regular expression: \/.*\/[a-z]*: /s, '');
		const hint = REGEX_ERROR_HINTS.find(([match]) => match.test(detail));
		return {
			valid: false,
			error: hint ? hint[1] : `Das Muster ist kein gültiger regulärer Ausdruck (${detail || 'unbekannter Fehler'}).`
		};
	}
	if (hasUnboundedLookbehind(pattern)) {
		return { valid: false, error: LOOKBEHIND_ERROR };
	}
	return { valid: true };
}

/**
 * Test a regex pattern against a string and return matches
 */
export function testRegex(
	pattern: string,
	input: string
): { matches: boolean; groups: string[]; firstGroup: string | null } {
	try {
		const regex = new RegExp(pattern);
		const match = input.match(regex);

		if (!match) {
			return { matches: false, groups: [], firstGroup: null };
		}

		// Get all capture groups (index 1 onwards)
		const groups = match.slice(1).filter(g => g !== undefined);

		return {
			matches: true,
			groups,
			firstGroup: groups[0] || null
		};
	} catch {
		return { matches: false, groups: [], firstGroup: null };
	}
}

/**
 * Check if a season/episode regex is static (like "S01" or "E05")
 */
export function isStaticSeasonEpisode(regex: string): boolean {
	// Static patterns: S01, S1, E01, E1, etc.
	return /^[SE]\d{1,4}$/i.test(regex);
}

/**
 * Extract value from static season/episode pattern
 */
export function extractStaticValue(pattern: string): number | null {
	const match = pattern.match(/^[SE](\d{1,4})$/i);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Whether a filter compares numbers (mirrors the API validation)
 */
export function requiresNumericFilterValue(filter: Pick<Filter, 'attribute' | 'type'>): boolean {
	return filter.attribute === 'duration' || filter.type === 'GreaterThan' || filter.type === 'LessThan';
}

/**
 * Only plain decimals, so the preview and MediathekArr (.NET) parse them identically
 */
export function isNumericFilterValue(value: string): boolean {
	return /^\d+(\.\d+)?$/.test(value);
}

/**
 * Parse an extracted season/episode value as strictly as MediathekArr (.NET int.TryParse)
 */
export function parseStrictInt(value: string): number | null {
	return /^\s*[+-]?\d+\s*$/.test(value) ? parseInt(value, 10) : null;
}

/**
 * Evaluate all filters against a media item
 */
export function evaluateFilters(
	item: MediathekItem,
	filters: Filter[]
): FilterCheckResult[] {
	return filters.map((filter, index) => {
		const actualValue = getItemAttribute(item, filter.attribute);
		const passed = checkFilter(actualValue, filter.type, filter.value, filter.attribute);

		let explanation: string;
		if (filter.attribute === 'duration') {
			// Duration is compared in seconds but displayed in minutes
			const actualMinutes = Math.round(Number(actualValue) / 60);
			const expectedMinutes = Number(filter.value);
			explanation = passed
				? `${actualMinutes} min ${getFilterSymbol(filter.type)} ${expectedMinutes} min`
				: `${actualMinutes} min ist nicht ${getFilterSymbol(filter.type)} ${expectedMinutes} min`;
		} else {
			explanation = passed
				? `"${actualValue}" ${getFilterExplanation(filter.type)} "${filter.value}"`
				: `"${actualValue}" ${getFilterExplanation(filter.type, true)} "${filter.value}"`;
		}

		return {
			filterIndex: index,
			attribute: filter.attribute,
			type: filter.type,
			expectedValue: filter.value,
			actualValue: String(actualValue),
			passed,
			explanation
		};
	});
}

/**
 * Get attribute value from media item
 */
function getItemAttribute(item: MediathekItem, attribute: string): string | number {
	switch (attribute) {
		case 'duration':
			return item.duration;
		case 'channel':
			return item.channel;
		case 'title':
			return item.title;
		case 'topic':
			return item.topic;
		case 'description':
			return item.description;
		default:
			return '';
	}
}

/**
 * Check if a value passes a filter
 */
function checkFilter(
	actual: string | number,
	type: string,
	expected: string,
	attribute: string
): boolean {
	// Duration is special: user enters minutes, API has seconds
	if (attribute === 'duration') {
		const actualSeconds = Number(actual);
		const expectedMinutes = Number(expected);
		const expectedSeconds = expectedMinutes * 60;

		switch (type) {
			case 'GreaterThan':
				return actualSeconds > expectedSeconds;
			case 'LessThan':
				return actualSeconds < expectedSeconds;
			case 'Equals':
				return actualSeconds === expectedSeconds;
			default:
				return false;
		}
	}

	// String comparisons
	const actualStr = String(actual).toLowerCase();
	const expectedStr = expected.toLowerCase();

	switch (type) {
		case 'Equals':
			return actualStr === expectedStr;
		case 'Contains':
			return actualStr.includes(expectedStr);
		case 'Regex':
			try {
				const regex = new RegExp(expected, 'i');
				return regex.test(String(actual));
			} catch {
				return false; // Invalid regex fails
			}
		case 'GreaterThan':
			return Number(actual) > Number(expected);
		case 'LessThan':
			return Number(actual) < Number(expected);
		default:
			return false;
	}
}

/**
 * Get filter comparison symbol
 */
function getFilterSymbol(type: string): string {
	switch (type) {
		case 'GreaterThan':
			return '>';
		case 'LessThan':
			return '<';
		case 'Equals':
			return '=';
		default:
			return type;
	}
}

/**
 * Get filter explanation text
 */
function getFilterExplanation(type: string, negative: boolean = false): string {
	const explanations: Record<string, [string, string]> = {
		Equals: ['entspricht', 'entspricht nicht'],
		Contains: ['enthält', 'enthält nicht'],
		Regex: ['matcht', 'matcht nicht'],
		GreaterThan: ['>', 'nicht >'],
		LessThan: ['<', 'nicht <']
	};

	const [pos, neg] = explanations[type] || [type, `nicht ${type}`];
	return negative ? neg : pos;
}

/**
 * Build title from regex rules
 */
export function buildTitleFromRules(
	item: MediathekItem,
	rules: RegexRule[]
): { steps: TitleConstructionStep[]; finalTitle: string | null } {
	const steps: TitleConstructionStep[] = [];
	let runningTitle = '';
	let failed = false;

	for (let i = 0; i < rules.length; i++) {
		const rule = rules[i];

		if (rule.type === 'static') {
			// Static rules always succeed
			const value = rule.value || '';
			runningTitle += value;

			steps.push({
				stepIndex: i,
				ruleType: 'static',
				input: value,
				result: value,
				success: true,
				runningTitle
			});
		} else if (rule.type === 'regex') {
			// Regex rules can fail
			const field = rule.field || 'title';
			const pattern = rule.pattern || '';
			const inputValue = getItemAttribute(item, field) as string;

			const { firstGroup } = testRegex(pattern, inputValue);

			if (firstGroup !== null) {
				runningTitle += firstGroup;
				steps.push({
					stepIndex: i,
					ruleType: 'regex',
					input: pattern,
					field,
					result: firstGroup,
					success: true,
					runningTitle
				});
			} else {
				// Regex failed - entire chain fails
				failed = true;
				steps.push({
					stepIndex: i,
					ruleType: 'regex',
					input: pattern,
					field,
					result: null,
					success: false,
					runningTitle,
					error: `Muster "${pattern}" hat keine Übereinstimmung in "${inputValue}" gefunden`
				});
				break;
			}
		}
	}

	return {
		steps,
		finalTitle: failed ? null : runningTitle
	};
}

/**
 * Extract season and episode numbers
 */
export function extractSeasonEpisode(
	constructedTitle: string,
	seasonRegex: string | undefined,
	episodeRegex: string | undefined
): SeasonEpisodeExtraction {
	const result: SeasonEpisodeExtraction = {
		seasonRegex: seasonRegex || '',
		episodeRegex: episodeRegex || '',
		seasonValue: null,
		episodeValue: null,
		isSeasonStatic: false,
		isEpisodeStatic: false,
		success: false
	};

	// Extract season
	if (seasonRegex) {
		if (isStaticSeasonEpisode(seasonRegex)) {
			result.isSeasonStatic = true;
			result.seasonValue = String(extractStaticValue(seasonRegex));
		} else {
			const { firstGroup } = testRegex(seasonRegex, constructedTitle);
			result.seasonValue = firstGroup;
		}
	}

	// Extract episode
	if (episodeRegex) {
		if (isStaticSeasonEpisode(episodeRegex)) {
			result.isEpisodeStatic = true;
			result.episodeValue = String(extractStaticValue(episodeRegex));
		} else {
			const { firstGroup } = testRegex(episodeRegex, constructedTitle);
			result.episodeValue = firstGroup;
		}
	}

	// Determine success based on what was needed
	result.success = (result.seasonValue !== null || !seasonRegex) &&
		(result.episodeValue !== null || !episodeRegex);

	return result;
}

/**
 * Check for skip keywords in title
 */
export function checkSkipKeywords(title: string): string | null {
	const skipKeywords = [
		'Audiodeskription',
		'(AD)',
		'Hörfassung',
		'Gebärdensprache',
		'(OmU)',
		'(OV)',
		'Originalversion'
	];

	const lowerTitle = title.toLowerCase();
	for (const keyword of skipKeywords) {
		if (lowerTitle.includes(keyword.toLowerCase())) {
			return keyword;
		}
	}

	return null;
}
