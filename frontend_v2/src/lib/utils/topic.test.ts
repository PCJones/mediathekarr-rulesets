import { describe, expect, it } from 'vitest';
import { normalizeTopic } from './topic';

describe('normalizeTopic', () => {
	it('replaces typographic dashes with a hyphen', () => {
		expect(normalizeTopic('In aller Freundschaft – Die jungen Ärzte')).toBe('In aller Freundschaft - Die jungen Ärzte');
		expect(normalizeTopic('A — B')).toBe('A - B');
	});

	it('replaces typographic quotes with straight quotes', () => {
		expect(normalizeTopic('„Rapunzel“ – Der neue Fall')).toBe('"Rapunzel" - Der neue Fall');
		expect(normalizeTopic('Grey’s Anatomy')).toBe("Grey's Anatomy");
	});

	it('keeps umlauts and plain text unchanged', () => {
		expect(normalizeTopic('  Sturm der Liebe ')).toBe('Sturm der Liebe');
		expect(normalizeTopic('Tatort – Österreich')).toBe('Tatort - Österreich');
	});
});
