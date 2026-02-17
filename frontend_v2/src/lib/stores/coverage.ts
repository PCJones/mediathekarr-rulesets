/**
 * Coverage Store
 * Multi-ruleset coverage evaluation
 * Loads other rulesets for the same media and evaluates which items they match
 */

import { writable, derived } from 'svelte/store';
import type { Ruleset, MediathekItem, Filter } from '$types';

interface CoverageState {
	/** Other rulesets for the same media (excluding the one being edited) */
	otherRulesets: Ruleset[];
	/** Map of item ID -> array of ruleset IDs that match it */
	coverageMap: Map<string, number[]>;
	/** Whether evaluation is in progress */
	isEvaluating: boolean;
}

const initialState: CoverageState = {
	otherRulesets: [],
	coverageMap: new Map(),
	isEvaluating: false
};

function createCoverageStore() {
	const { subscribe, set, update } = writable<CoverageState>(initialState);

	return {
		subscribe,

		/** Set the other rulesets for coverage comparison */
		setOtherRulesets: (rulesets: Ruleset[]) => {
			update(state => ({ ...state, otherRulesets: rulesets, coverageMap: new Map() }));
		},

		/** Evaluate coverage: which items are matched by other rulesets */
		evaluate: (items: MediathekItem[]) => {
			update(state => {
				if (state.otherRulesets.length === 0) {
					return { ...state, coverageMap: new Map(), isEvaluating: false };
				}

				state.isEvaluating = true;
				const coverageMap = new Map<string, number[]>();

				for (const item of items) {
					const matchingRulesetIds: number[] = [];

					for (const ruleset of state.otherRulesets) {
						if (ruleset.id && itemMatchesRuleset(item, ruleset)) {
							matchingRulesetIds.push(ruleset.id);
						}
					}

					if (matchingRulesetIds.length > 0) {
						coverageMap.set(item.id, matchingRulesetIds);
					}
				}

				return { ...state, coverageMap, isEvaluating: false };
			});
		},

		/** Clear coverage data */
		clear: () => {
			set(initialState);
		}
	};
}

/**
 * Check if an item would pass a ruleset's filters
 * (Simplified: only checks filters, not full title construction + matching)
 */
function itemMatchesRuleset(item: MediathekItem, ruleset: Ruleset): boolean {
	// Check topic match first
	const topics = ruleset.topic.split('|').map(t => t.trim().toLowerCase());
	if (!topics.some(t => item.topic.toLowerCase().includes(t))) {
		return false;
	}

	// Check all filters pass
	return ruleset.filters.every(filter => checkFilter(item, filter));
}

function checkFilter(item: MediathekItem, filter: Filter): boolean {
	let fieldValue: string | number;

	if (filter.attribute === 'duration') {
		fieldValue = Math.round(item.duration / 60);
		const filterVal = parseInt(filter.value, 10);
		if (isNaN(filterVal)) return true;

		switch (filter.type) {
			case 'GreaterThan': return fieldValue > filterVal;
			case 'LessThan': return fieldValue < filterVal;
			case 'Equals': return fieldValue === filterVal;
			default: return true;
		}
	}

	fieldValue = (item[filter.attribute as keyof MediathekItem] as string) || '';
	const filterVal = filter.value;
	const fieldLower = fieldValue.toString().toLowerCase();

	switch (filter.type) {
		case 'Equals': return fieldLower === filterVal.toLowerCase();
		case 'Contains': return fieldLower.includes(filterVal.toLowerCase());
		case 'Regex':
			try {
				return new RegExp(filterVal, 'i').test(fieldValue.toString());
			} catch {
				return true;
			}
		default: return true;
	}
}

export const coverageStore = createCoverageStore();

// Derived: count of items covered by other rulesets
export const coveredItemCount = derived(coverageStore, ($coverage) => $coverage.coverageMap.size);
