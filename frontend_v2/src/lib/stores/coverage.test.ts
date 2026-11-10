import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { Ruleset } from '$types';
import { coverageStore, NEW_RULESET_SENTINEL_ID, simulatedRulesets } from './coverage';

function ruleset(id: number | undefined, priority: number): Ruleset {
	return {
		id,
		mediaId: 7,
		topic: `T${id ?? 'neu'}`,
		priority,
		matchingStrategy: 'ItemTitleIncludes',
		filters: [],
		titleRegexRules: []
	};
}

beforeEach(() => coverageStore.clear());

describe('coverageStore', () => {
	it('places a new ruleset last when the list is loaded first', () => {
		coverageStore.setAllRulesets([ruleset(5, 0), ruleset(6, 1)]);
		coverageStore.setCurrentRuleset(undefined);
		coverageStore.setCurrentRulesetEntry(ruleset(undefined, 0));

		expect(get(simulatedRulesets).map((s) => s.id)).toEqual([5, 6, NEW_RULESET_SENTINEL_ID]);
	});

	it('places a new ruleset last when the list arrives later', () => {
		coverageStore.setCurrentRuleset(undefined);
		coverageStore.setCurrentRulesetEntry(ruleset(undefined, 0));
		coverageStore.setAllRulesets([ruleset(5, 0), ruleset(6, 1)]);

		expect(get(simulatedRulesets).map((s) => s.id)).toEqual([5, 6, NEW_RULESET_SENTINEL_ID]);
	});

	it('keeps a moved new ruleset in place while it is edited', () => {
		coverageStore.setAllRulesets([ruleset(5, 0), ruleset(6, 1)]);
		coverageStore.setCurrentRulesetEntry(ruleset(undefined, 0));
		coverageStore.moveRulesetUp(NEW_RULESET_SENTINEL_ID);
		coverageStore.setCurrentRulesetEntry({ ...ruleset(undefined, 0), topic: 'geändert' });

		expect(get(simulatedRulesets).map((s) => s.id)).toEqual([5, NEW_RULESET_SENTINEL_ID, 6]);
	});

	it('moves a new ruleset back to the end on reset', () => {
		coverageStore.setAllRulesets([ruleset(5, 0), ruleset(6, 1)]);
		coverageStore.setCurrentRulesetEntry(ruleset(undefined, 0));
		coverageStore.moveRulesetUp(NEW_RULESET_SENTINEL_ID);
		coverageStore.moveRulesetUp(NEW_RULESET_SENTINEL_ID);
		coverageStore.setCurrentRulesetEntry(ruleset(undefined, 0));
		coverageStore.resetSimulation();

		expect(get(simulatedRulesets).map((s) => s.id)).toEqual([5, 6, NEW_RULESET_SENTINEL_ID]);
	});
});
