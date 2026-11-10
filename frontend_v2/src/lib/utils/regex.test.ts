import { describe, expect, it } from 'vitest';
import { hasUnboundedLookbehind, validateRegex } from './regex';

describe('hasUnboundedLookbehind', () => {
	it('flags * and + inside a lookbehind', () => {
		expect(hasUnboundedLookbehind('(?<=Tatort:\\s*)\\S.*')).toBe(true);
		expect(hasUnboundedLookbehind('(?<!\\d+)x')).toBe(true);
		expect(hasUnboundedLookbehind('(?<=a{2,})b')).toBe(true);
	});

	it('accepts bounded lookbehinds and quantifiers outside of them', () => {
		expect(hasUnboundedLookbehind('(?<=S)(\\d{2,4})(?=\\s*/E\\d{2,4})')).toBe(false);
		expect(hasUnboundedLookbehind('(?<=Tatort: )(.+)')).toBe(false);
		expect(hasUnboundedLookbehind('(?<=a{0,3})b')).toBe(false);
		expect(hasUnboundedLookbehind('Tatort:\\s*(\\S.*)')).toBe(false);
	});

	it('ignores escaped and character-class quantifiers', () => {
		expect(hasUnboundedLookbehind('(?<=\\*)x')).toBe(false);
		expect(hasUnboundedLookbehind('(?<=[*+])x')).toBe(false);
		expect(hasUnboundedLookbehind('\\(?<=a*')).toBe(false);
	});
});

describe('validateRegex', () => {
	it('accepts valid patterns', () => {
		expect(validateRegex('«(.*?)»')).toEqual({ valid: true });
	});

	it('explains common syntax errors in German', () => {
		expect(validateRegex('(abc').error).toBe('Es fehlt eine schließende Klammer „)“.');
		expect(validateRegex('*a').error).toContain('Wiederholungszeichen');
		expect(validateRegex('[z-a]').error).toContain('[a-z]');
	});

	it('rejects lookbehinds the API cannot store', () => {
		const result = validateRegex('(?<=Tatort:\\s*)\\S.*');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Tatort:\\s*(.+)');
	});
});
