import { describe, expect, it } from 'vitest';
import { gridColumns, rulesetTableDensity, splitCaptureGroups } from './rulesetFacets';

describe('rulesetTableDensity', () => {
	it('uses the normal breakpoint for one pattern column plus at most one text column', () => {
		expect(rulesetTableDensity(['extraction', 'filters'])).toBe('normal');
		expect(rulesetTableDensity(['topic'])).toBe('normal');
	});

	it('needs the wider breakpoint for two pattern columns or several text columns', () => {
		expect(rulesetTableDensity(['extraction', 'titleRules'])).toBe('dense');
		expect(rulesetTableDensity(['strategy', 'extraction', 'filters'])).toBe('dense');
	});
});

describe('splitCaptureGroups', () => {
	it('flags capture groups and splits lookarounds into their own plain parts', () => {
		expect(splitCaptureGroups('(?<=S)(\\d{2,4})(?=\\s*/E\\d{2,4})')).toEqual([
			{ text: '(?<=S)', group: false },
			{ text: '(\\d{2,4})', group: true },
			{ text: '(?=\\s*/E\\d{2,4})', group: false }
		]);
	});

	it('keeps escaped parentheses and character classes as plain text', () => {
		expect(splitCaptureGroups('\\bS\\d{2,4}\\s*/E(\\d{2,4})\\)')).toEqual([
			{ text: '\\bS\\d{2,4}\\s*/E', group: false },
			{ text: '(\\d{2,4})', group: true },
			{ text: '\\)', group: false }
		]);
		expect(splitCaptureGroups('[(]x(y)')).toEqual([
			{ text: '[(]x', group: false },
			{ text: '(y)', group: true }
		]);
	});

	it('keeps nested groups inside their top-level group', () => {
		expect(splitCaptureGroups('a(?:b(c))d')).toEqual([
			{ text: 'a', group: false },
			{ text: '(?:b(c))', group: false },
			{ text: 'd', group: false }
		]);
	});

	it('treats an unclosed group by its opening kind', () => {
		expect(splitCaptureGroups('x(\\d+')).toEqual([
			{ text: 'x', group: false },
			{ text: '(\\d+', group: true }
		]);
		expect(splitCaptureGroups('x(?=\\d+')).toEqual([
			{ text: 'x', group: false },
			{ text: '(?=\\d+', group: false }
		]);
	});
});

describe('gridColumns', () => {
	it('gives a pattern column a real minimum and caps the text columns', () => {
		expect(gridColumns(['topic', 'extraction', 'filters'])).toBe(
			'auto auto minmax(12rem, 1fr) fit-content(12rem) fit-content(13rem) fit-content(10rem) auto'
		);
	});

	it('shares the pattern budget when both pattern columns vary', () => {
		expect(gridColumns(['extraction', 'titleRules'])).toBe(
			'auto minmax(8rem, 1fr) minmax(8rem, 1fr) fit-content(13rem) fit-content(10rem) auto'
		);
	});

	it('lets the actions column absorb free space when no pattern column varies', () => {
		expect(gridColumns(['topic', 'filters'])).toBe(
			'auto auto fit-content(12rem) fit-content(13rem) minmax(0, 1fr) auto'
		);
	});
});
