import { describe, expect, it } from 'vitest';
import type { Ruleset } from '$types';
import type { SuggestionChange, SuggestionRuleset } from '$types/suggestion';
import {
	defaultOrder,
	hasUnsavedEdits,
	mergeChanges,
	resolveProposalDraft,
	sameDraftContent,
	savedContent,
	type DraftContent,
	type ProposalDraftSource
} from './draftContent';

const live: Ruleset[] = [
	{
		id: 11,
		mediaId: 7,
		priority: 0,
		topic: 'Polizeiruf 110',
		matchingStrategy: 'SeasonAndEpisodeNumber',
		filters: [{ attribute: 'duration', type: 'GreaterThan', value: '62' }],
		titleRegexRules: [],
		seasonRegex: 'S01',
		episodeRegex: 'E01'
	},
	{
		id: 12,
		mediaId: 7,
		priority: 1,
		topic: 'Polizeiruf',
		matchingStrategy: 'ItemTitleIncludes',
		filters: [],
		titleRegexRules: [],
		seasonRegex: undefined,
		episodeRegex: undefined
	}
];

const serverBase: SuggestionRuleset = {
	id: 11,
	mediaId: 7,
	topic: 'Polizeiruf 110',
	priority: 0,
	filters: [{ attribute: 'duration', type: 'GreaterThan', value: '62' }],
	titleRegexRules: [],
	episodeRegex: 'E01',
	seasonRegex: 'S01',
	matchingStrategy: 'SeasonAndEpisodeNumber'
};

function update(value: string, base: SuggestionRuleset = serverBase): SuggestionChange {
	return {
		key: 'r11',
		op: 'update',
		rulesetId: 11,
		base: { hash: 'abc', ruleset: base },
		ruleset: {
			topic: 'Polizeiruf 110',
			filters: [{ attribute: 'duration', type: 'GreaterThan', value }],
			titleRegexRules: [],
			episodeRegex: 'E01',
			seasonRegex: 'S01',
			matchingStrategy: 'SeasonAndEpisodeNumber'
		},
		snapshot: null
	};
}

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

function revision(number: number, changes: SuggestionChange[], order: string[] | null = null) {
	return { number, description: 'Begründung', bundle: { changes, order, coverage: null } };
}

function draft(
	content: Partial<DraftContent>,
	baseRevision: number | null,
	saved: DraftContent | null
): ProposalDraftSource {
	return {
		description: 'Begründung',
		changes: [],
		order: null,
		...content,
		baseRevision,
		saved
	};
}

describe('sameDraftContent', () => {
	it('ignores key order inside the base ruleset', () => {
		const reordered = {
			id: 11,
			mediaId: 7,
			priority: 0,
			matchingStrategy: 'SeasonAndEpisodeNumber',
			topic: 'Polizeiruf 110',
			filters: [{ value: '62', type: 'GreaterThan', attribute: 'duration' }],
			titleRegexRules: [],
			seasonRegex: 'S01',
			episodeRegex: 'E01'
		} as SuggestionRuleset;
		const local = { ...update('60', reordered), base: { ruleset: reordered } };
		const saved = savedContent(revision(1, [update('60')]));
		expect(sameDraftContent({ ...saved, changes: [local] }, saved, live)).toBe(true);
	});

	it('treats empty regex and null as equal', () => {
		const a = update('60');
		const b = { ...a, ruleset: { ...a.ruleset!, seasonRegex: '' } };
		const c = { ...a, ruleset: { ...a.ruleset!, seasonRegex: null } };
		const base = { description: '', order: null };
		expect(sameDraftContent({ ...base, changes: [b] }, { ...base, changes: [c] }, live)).toBe(true);
	});

	it('ignores snapshots and the order of the changes array', () => {
		const changes = [update('60'), create('c1', 'Neu')];
		const a: DraftContent = { description: 'x', order: null, changes };
		const b: DraftContent = {
			description: 'x',
			order: null,
			changes: [
				{ ...changes[1], snapshot: { capturedAt: 'now' } as never },
				changes[0]
			]
		};
		expect(sameDraftContent(a, b, live)).toBe(true);
	});

	it('treats an explicit default order like no order', () => {
		const a: DraftContent = { description: 'x', order: null, changes: [create('c1', 'Neu')] };
		const b: DraftContent = { ...a, order: ['11', '12', 'c1'] };
		expect(sameDraftContent(a, b, live)).toBe(true);
		expect(sameDraftContent(a, { ...a, order: ['12', '11', 'c1'] }, live)).toBe(false);
	});

	it('detects a rebased change', () => {
		const saved = savedContent(revision(1, [update('60')]));
		const rebased = update('60', { ...serverBase, filters: [] });
		expect(sameDraftContent({ ...saved, changes: [rebased] }, saved, live)).toBe(false);
	});
});

describe('hasUnsavedEdits', () => {
	it('is false right after loading a revision', () => {
		const rev = revision(3, [update('50')]);
		const saved = savedContent(rev);
		expect(hasUnsavedEdits(draft(saved, 3, saved), live)).toBe(false);
	});

	it('is true for a changed value', () => {
		const saved = savedContent(revision(3, [update('50')]));
		expect(hasUnsavedEdits(draft({ changes: [update('55')] }, 3, saved), live)).toBe(true);
	});

	it('is true for a discarded change', () => {
		const saved = savedContent(revision(3, [update('50')]));
		expect(hasUnsavedEdits(draft({ changes: [] }, 3, saved), live)).toBe(true);
	});

	it('is true for a changed description', () => {
		const saved = savedContent(revision(3, [update('50')]));
		expect(hasUnsavedEdits(draft({ ...saved, description: 'Neu' }, 3, saved), live)).toBe(true);
	});

	it('treats empty regex and null in the base as equal', () => {
		const saved = savedContent(revision(3, [update('50', { ...serverBase, seasonRegex: '' })]));
		const local = update('50', { ...serverBase, seasonRegex: null });
		expect(hasUnsavedEdits(draft({ changes: [local] }, 3, saved), live)).toBe(false);
	});
});

describe('resolveProposalDraft', () => {
	const rev3 = savedContent(revision(3, [update('50')]));

	it('loads the server state without a local draft', () => {
		expect(resolveProposalDraft(null, 3, live, false)).toBe('load');
	});

	it('loads the server state for an unchanged local draft on the current revision', () => {
		expect(resolveProposalDraft(draft(rev3, 3, rev3), 3, live, false)).toBe('load');
	});

	it('loads the newer server state for an unchanged but outdated local draft', () => {
		expect(resolveProposalDraft(draft(rev3, 3, rev3), 4, live, false)).toBe('load');
	});

	it('resumes local edits on the current revision', () => {
		expect(resolveProposalDraft(draft({ changes: [update('55')] }, 3, rev3), 3, live, false)).toBe(
			'resume'
		);
	});

	it('reports a conflict for local edits on an outdated revision', () => {
		expect(resolveProposalDraft(draft({ changes: [update('55')] }, 3, rev3), 4, live, false)).toBe(
			'conflict'
		);
	});

	it('reports a conflict after a rejected save', () => {
		expect(resolveProposalDraft(draft({ changes: [update('55')] }, 3, rev3), 3, live, true)).toBe(
			'conflict'
		);
	});

	it('loads the server state after a rejected save without local edits', () => {
		expect(resolveProposalDraft(draft(rev3, 3, rev3), 4, live, true)).toBe('load');
	});
});

describe('mergeChanges', () => {
	it('re-keys creates that collide with the target', () => {
		const target: DraftContent = { description: 'Ziel', order: null, changes: [create('c1', 'A')] };
		const source: DraftContent = { description: '', order: null, changes: [create('c1', 'B')] };
		const merged = mergeChanges(target, source);
		expect(merged.changes.map((c) => [c.key, c.ruleset?.topic])).toEqual([
			['c1', 'A'],
			['c2', 'B']
		]);
	});

	it('appends merged creates to an explicit order', () => {
		const target: DraftContent = {
			description: 'Ziel',
			order: ['12', '11', 'c1'],
			changes: [create('c1', 'A')]
		};
		const merged = mergeChanges(target, {
			description: '',
			order: null,
			changes: [create('c1', 'B')]
		});
		expect(merged.order).toEqual(['12', '11', 'c1', 'c2']);
	});

	it('replaces a change for the same ruleset and keeps its key', () => {
		const target: DraftContent = { description: 'Ziel', order: null, changes: [update('50')] };
		const source: DraftContent = {
			description: '',
			order: null,
			changes: [{ ...update('55'), key: 'x' }]
		};
		const merged = mergeChanges(target, source);
		expect(merged.changes).toHaveLength(1);
		expect(merged.changes[0].key).toBe('r11');
		expect(merged.changes[0].ruleset?.filters[0].value).toBe('55');
	});

	it('drops a deleted ruleset from the order', () => {
		const target: DraftContent = { description: 'Ziel', order: ['12', '11'], changes: [] };
		const merged = mergeChanges(target, {
			description: '',
			order: null,
			changes: [{ key: 'r12', op: 'delete', rulesetId: 12, base: { ruleset: serverBase }, snapshot: null }]
		});
		expect(merged.order).toEqual(['11']);
	});

	it('keeps the target description unless it is empty', () => {
		const empty: DraftContent = { description: '', order: null, changes: [] };
		expect(mergeChanges({ ...empty, description: 'Ziel' }, { ...empty, description: 'Quelle' }).description).toBe('Ziel');
		expect(mergeChanges(empty, { ...empty, description: 'Quelle' }).description).toBe('Quelle');
	});
});

describe('defaultOrder', () => {
	it('skips deleted rulesets and appends creates', () => {
		const order = defaultOrder(
			{
				changes: [
					{ key: 'r11', op: 'delete', rulesetId: 11, base: { ruleset: serverBase }, snapshot: null },
					create('c1', 'Neu')
				]
			},
			live
		);
		expect(order).toEqual(['12', 'c1']);
	});
});
