import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ruleset } from '$types';
import type { SuggestionChange, SuggestionRevision } from '$types/suggestion';
import { mediaDraftKey, suggestionDraft, suggestionDraftKey } from './suggestionDraft';

function create(key: string, topic: string): SuggestionChange {
	return {
		key,
		op: 'create',
		ruleset: {
			topic,
			matchingStrategy: 'ItemTitleIncludes',
			filters: [],
			titleRegexRules: [],
			seasonRegex: null,
			episodeRegex: null
		},
		snapshot: null
	};
}

function revision(number: number, changes: SuggestionChange[]): SuggestionRevision {
	return {
		number,
		author: 'testuser',
		createdAt: '2026-11-03 12:00:00',
		description: `Revision ${number}`,
		bundle: { changes, order: null, coverage: null }
	};
}

beforeEach(() => {
	const storage = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => void storage.set(key, value),
		removeItem: (key: string) => void storage.delete(key)
	});
	suggestionDraft.clear();
});

describe('suggestionDraft', () => {
	it('loadFromRevision sets the base revision and its saved content', () => {
		const state = suggestionDraft.loadFromRevision(24, revision(3, [create('c1', 'A')]), {
			mediaId: 7
		});
		expect(state.key).toBe(suggestionDraftKey(24));
		expect(state.baseRevision).toBe(3);
		expect(state.saved?.changes.map((c) => c.key)).toEqual(['c1']);
		expect(suggestionDraft.peek(suggestionDraftKey(24))?.baseRevision).toBe(3);
	});

	it('adoptRevision keeps the local content and moves base and saved forward', () => {
		suggestionDraft.loadFromRevision(24, revision(3, [create('c1', 'A')]), { mediaId: 7 });
		suggestionDraft.stageCreate(create('c2', 'Lokal').ruleset!, null);
		suggestionDraft.adoptRevision(revision(4, [create('c1', 'B')]));

		const state = suggestionDraft.get();
		expect(state.baseRevision).toBe(4);
		expect(state.saved?.changes[0].ruleset?.topic).toBe('B');
		expect(state.changes.map((c) => c.ruleset?.topic)).toEqual(['A', 'Lokal']);
	});

	it('close empties the store but keeps the persisted draft', () => {
		suggestionDraft.loadFromRevision(24, revision(3, [create('c1', 'A')]), { mediaId: 7 });
		suggestionDraft.close();
		expect(suggestionDraft.get().key).toBe('');
		suggestionDraft.setCoverage(null);
		expect(suggestionDraft.peek(suggestionDraftKey(24))?.changes).toHaveLength(1);
	});

	it('open keeps the stored base revision', () => {
		suggestionDraft.loadFromRevision(24, revision(3, []), { mediaId: 7 });
		const state = suggestionDraft.open(suggestionDraftKey(24), { mediaId: 7, suggestionId: 24 });
		expect(state.baseRevision).toBe(3);
	});

	it('mergeInto keeps both creates and the target revision, and removes the source draft', () => {
		suggestionDraft.loadFromRevision(24, revision(3, [create('c1', 'Vorschlag')]), { mediaId: 7 });
		suggestionDraft.open(mediaDraftKey(7), { mediaId: 7 });
		suggestionDraft.stageCreate(create('c1', 'Lokal').ruleset!, null);

		const merged = suggestionDraft.mergeInto(suggestionDraftKey(24), []);

		expect(merged.changes.map((c) => [c.key, c.ruleset?.topic])).toEqual([
			['c1', 'Vorschlag'],
			['c2', 'Lokal']
		]);
		expect(merged.baseRevision).toBe(3);
		expect(merged.saved?.changes).toHaveLength(1);
		expect(suggestionDraft.peek(mediaDraftKey(7))).toBeNull();
		expect(suggestionDraft.get().key).toBe(suggestionDraftKey(24));
	});

	it('stageCreate stores the given order with the change', () => {
		suggestionDraft.open(mediaDraftKey(7), { mediaId: 7 });
		suggestionDraft.stageCreate(create('c1', 'A').ruleset!, null, 'c1', ['c1', '5']);

		const stored = suggestionDraft.peek(mediaDraftKey(7));
		expect(stored?.changes.map((c) => c.key)).toEqual(['c1']);
		expect(stored?.order).toEqual(['c1', '5']);
	});

	it('stageCreate without order appends the key to an explicit order', () => {
		suggestionDraft.open(mediaDraftKey(7), { mediaId: 7 });
		suggestionDraft.setOrder(['6', '5']);
		suggestionDraft.stageCreate(create('c1', 'A').ruleset!, null);
		expect(suggestionDraft.get().order).toEqual(['6', '5', 'c1']);
	});

	it('stageUpdate stores the given order with the change', () => {
		suggestionDraft.open(mediaDraftKey(7), { mediaId: 7 });
		const base: Ruleset = {
			id: 5,
			mediaId: 7,
			topic: 'A',
			priority: 0,
			matchingStrategy: 'ItemTitleIncludes',
			filters: [],
			titleRegexRules: []
		};
		suggestionDraft.stageUpdate({ ...base, topic: 'B' }, base, null, ['6', '5']);

		const stored = suggestionDraft.peek(mediaDraftKey(7));
		expect(stored?.changes[0].ruleset?.topic).toBe('B');
		expect(stored?.order).toEqual(['6', '5']);
	});
});
