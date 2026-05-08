/**
 * Coverage Store
 * Priority-aware multi-ruleset coverage evaluation with full matching pipeline
 * and simulation capabilities (toggle rulesets, reorder priorities).
 */

import { writable, derived } from 'svelte/store';
import type { Ruleset, MediathekItem, TvdbEpisode } from '$types';
import { evaluateFilters, checkSkipKeywords, buildTitleFromRules } from '$utils/regex';
import { matchEpisodeByStrategy } from '$utils/tvdbMatcher';

// ─── Types ───────────────────────────────────────────────────────

export interface CoverageMatch {
	rulesetId: number;
	priority: number;
}

export interface SimulatedRuleset {
	/** Always present — only rulesets with an id enter simulation */
	id: number;
	ruleset: Ruleset;
	enabled: boolean;
	simulatedPriority: number;
}

interface CoverageState {
	/** All rulesets for the media (including current) */
	allRulesets: Ruleset[];
	/** ID of the ruleset currently being edited (undefined for new) */
	currentRulesetId: number | undefined;
	/** TVDB episodes for matching */
	tvdbEpisodes: TvdbEpisode[];
	/** Map of item ID -> array of CoverageMatch (rulesets that match it) */
	coverageMap: Map<string, CoverageMatch[]>;
	/** Whether evaluation is in progress */
	isEvaluating: boolean;
	/** Simulation overrides: rulesetId -> SimulatedRuleset */
	simulation: Map<number, SimulatedRuleset>;
}

/** Sentinel ID used for new (unsaved) rulesets in the simulator */
export const NEW_RULESET_SENTINEL_ID = -1;

const initialState: CoverageState = {
	allRulesets: [],
	currentRulesetId: undefined,
	tvdbEpisodes: [],
	coverageMap: new Map(),
	isEvaluating: false,
	simulation: new Map()
};

// ─── Full-pipeline item matching ─────────────────────────────────

/**
 * Run the complete matching pipeline for an item against a ruleset.
 * Steps: topic match → skip keywords → filter evaluation → title construction → TVDB matching
 */
function fullMatchItem(
	item: MediathekItem,
	ruleset: Ruleset,
	tvdbEpisodes: TvdbEpisode[]
): boolean {
	// 1. Topic match (pipe-separated, case-insensitive)
	const topics = ruleset.topic.split('|').map(t => t.trim().toLowerCase());
	if (!topics.some(t => t.length > 0 && item.topic.toLowerCase().includes(t))) {
		return false;
	}

	// 2. Skip keywords check
	const skipKeyword = checkSkipKeywords(item.title);
	if (skipKeyword !== null) {
		return false;
	}

	// 3. Filter evaluation (all must pass)
	if (ruleset.filters.length > 0) {
		const filterResults = evaluateFilters(item, ruleset.filters);
		if (!filterResults.every(r => r.passed)) {
			return false;
		}
	}

	// 4. Title construction
	if (ruleset.titleRegexRules.length > 0) {
		const { finalTitle } = buildTitleFromRules(item, ruleset.titleRegexRules);
		if (finalTitle === null) {
			return false;
		}
	}

	// 5. TVDB matching (if episodes available)
	if (tvdbEpisodes.length > 0) {
		const tvdbResult = matchEpisodeByStrategy(
			item,
			tvdbEpisodes,
			ruleset.matchingStrategy,
			ruleset.titleRegexRules,
			ruleset.seasonRegex,
			ruleset.episodeRegex
		);
		if (!tvdbResult.matched) {
			return false;
		}
	}

	return true;
}

// ─── Store creation ──────────────────────────────────────────────

function createCoverageStore() {
	const { subscribe, set, update } = writable<CoverageState>(initialState);

	// Debounce timer scoped to this store instance (not module-level)
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	/** Initialize simulation state from rulesets */
	function initSimulation(rulesets: Ruleset[]): Map<number, SimulatedRuleset> {
		const sim = new Map<number, SimulatedRuleset>();
		for (const rs of rulesets) {
			if (rs.id != null) {
				sim.set(rs.id, {
					id: rs.id,
					ruleset: rs,
					enabled: true,
					simulatedPriority: rs.priority
				});
			}
		}
		return sim;
	}

	/**
	 * Move the entry with the given id by `delta` positions (-1 = up, +1 = down)
	 * in the priority-sorted order, then reassign all `simulatedPriority` values
	 * to consecutive 0..N-1 by position. Returns a new state slice.
	 */
	function reorder(state: CoverageState, id: number, delta: -1 | 1): CoverageState {
		const sorted = [...state.simulation.values()].sort(
			(a, b) => a.simulatedPriority - b.simulatedPriority
		);
		const idx = sorted.findIndex(s => s.id === id);
		const targetIdx = idx + delta;
		if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return state;

		[sorted[idx], sorted[targetIdx]] = [sorted[targetIdx], sorted[idx]];

		const sim = new Map<number, SimulatedRuleset>();
		sorted.forEach((entry, i) => {
			sim.set(entry.id, { ...entry, simulatedPriority: i });
		});

		return { ...state, simulation: sim };
	}

	return {
		subscribe,

		/**
		 * Merge loaded rulesets into the simulation.
		 *
		 * Merges (rather than replaces) because `setCurrentRulesetEntry` may have
		 * already populated the simulation with the entry currently being edited
		 * — sentinel for a new ruleset, or the real id for an existing one. A
		 * destructive rebuild here races with that path and can leave the
		 * simulation empty until the next keystroke if the orderings interleave.
		 */
		setAllRulesets: (rulesets: Ruleset[]) => {
			update(state => {
				const sim = new Map(state.simulation);
				const loadedIds = new Set<number>();

				for (const rs of rulesets) {
					if (rs.id == null) continue;
					loadedIds.add(rs.id);
					// Don't overwrite the entry currently being edited — it carries the
					// user's in-progress changes from setCurrentRulesetEntry.
					if (rs.id === state.currentRulesetId && sim.has(rs.id)) continue;
					sim.set(rs.id, {
						id: rs.id,
						ruleset: rs,
						enabled: true,
						simulatedPriority: rs.priority
					});
				}

				// Drop entries that are no longer in the loaded set, except the entry
				// being edited (sentinel for new, real id for existing).
				for (const id of [...sim.keys()]) {
					if (!loadedIds.has(id) && id !== state.currentRulesetId) {
						sim.delete(id);
					}
				}

				// Default the new-ruleset sentinel to the lowest priority (max + 1)
				// once existing rulesets are known.
				const sentinel = sim.get(NEW_RULESET_SENTINEL_ID);
				if (sentinel) {
					const otherPriorities = [...sim.values()]
						.filter(s => s.id !== NEW_RULESET_SENTINEL_ID)
						.map(s => s.simulatedPriority);
					const maxPriority = otherPriorities.length > 0 ? Math.max(...otherPriorities) : -1;
					sim.set(NEW_RULESET_SENTINEL_ID, {
						...sentinel,
						simulatedPriority: maxPriority + 1
					});
				}

				return {
					...state,
					allRulesets: rulesets,
					coverageMap: new Map(),
					simulation: sim
				};
			});
		},

		/** Set the current ruleset being edited */
		setCurrentRuleset: (id: number | undefined) => {
			update(state => ({
				...state,
				currentRulesetId: id ?? NEW_RULESET_SENTINEL_ID
			}));
		},

		/**
		 * Add or update the current ruleset's entry in the simulation.
		 * For new rulesets (no id), uses sentinel ID. For existing ones, updates in place.
		 */
		setCurrentRulesetEntry: (rulesetData: Omit<Ruleset, 'id'>, existingId?: number) => {
			update(state => {
				const id = existingId ?? NEW_RULESET_SENTINEL_ID;
				const sim = new Map(state.simulation);
				const existing = sim.get(id);
				sim.set(id, {
					id,
					ruleset: { ...rulesetData, id } as Ruleset,
					enabled: existing?.enabled ?? true,
					simulatedPriority: existing?.simulatedPriority ?? rulesetData.priority
				});
				return { ...state, simulation: sim, currentRulesetId: id };
			});
		},

		/** Set TVDB episodes for matching */
		setTvdbEpisodes: (episodes: TvdbEpisode[]) => {
			update(state => ({ ...state, tvdbEpisodes: episodes }));
		},

		/** Evaluate coverage with debounce: which items are matched by which rulesets */
		evaluate: (items: MediathekItem[]) => {
			if (debounceTimer) clearTimeout(debounceTimer);

			update(state => ({ ...state, isEvaluating: true }));

			debounceTimer = setTimeout(() => {
				update(state => {
					const coverageMap = new Map<string, CoverageMatch[]>();

					// Get enabled rulesets from simulation, excluding the current one being edited
					const enabledRulesets: Array<{ id: number; priority: number; ruleset: Ruleset }> = [];
					for (const [id, sim] of state.simulation) {
						if (sim.enabled && id !== state.currentRulesetId) {
							enabledRulesets.push({
								id,
								priority: sim.simulatedPriority,
								ruleset: sim.ruleset
							});
						}
					}

					if (enabledRulesets.length === 0) {
						return { ...state, coverageMap, isEvaluating: false };
					}

					for (const item of items) {
						const matches: CoverageMatch[] = [];

						for (const { id, priority, ruleset } of enabledRulesets) {
							try {
								if (fullMatchItem(item, ruleset, state.tvdbEpisodes)) {
									matches.push({ rulesetId: id, priority });
								}
							} catch {
								// Invalid regex or other error in other ruleset — skip
							}
						}

						if (matches.length > 0) {
							// Sort by priority (lower = higher priority)
							matches.sort((a, b) => a.priority - b.priority);
							coverageMap.set(item.id, matches);
						}
					}

					return { ...state, coverageMap, isEvaluating: false };
				});
			}, 300);
		},

		// ─── Simulation methods ───

		/** Toggle a ruleset on/off in the simulator */
		toggleRuleset: (id: number) => {
			update(state => {
				const sim = new Map(state.simulation);
				const entry = sim.get(id);
				if (entry) {
					sim.set(id, { ...entry, enabled: !entry.enabled });
				}
				return { ...state, simulation: sim };
			});
		},

		/** Set a specific simulated priority for a ruleset */
		setSimulatedPriority: (id: number, priority: number) => {
			update(state => {
				const sim = new Map(state.simulation);
				const entry = sim.get(id);
				if (entry) {
					sim.set(id, { ...entry, simulatedPriority: priority });
				}
				return { ...state, simulation: sim };
			});
		},

		/**
		 * Move a ruleset up (towards priority 0).
		 * Renumbers all entries to consecutive priorities (0..N-1) based on the new
		 * order. This eliminates ties and keeps 0 as the floor (no negatives).
		 */
		moveRulesetUp: (id: number) => {
			update(state => reorder(state, id, -1));
		},

		/**
		 * Move a ruleset down (towards higher priority numbers).
		 * Renumbers all entries to consecutive priorities (0..N-1) based on the new
		 * order. This eliminates ties and keeps 0 as the floor (no negatives).
		 */
		moveRulesetDown: (id: number) => {
			update(state => reorder(state, id, 1));
		},

		/** Reset simulation to actual priorities */
		resetSimulation: () => {
			update(state => {
				const sim = initSimulation(state.allRulesets);
				// Preserve sentinel entry with reset priority
				const sentinel = state.simulation.get(NEW_RULESET_SENTINEL_ID);
				if (sentinel) {
					sim.set(NEW_RULESET_SENTINEL_ID, {
						...sentinel,
						simulatedPriority: sentinel.ruleset.priority
					});
				}
				return { ...state, simulation: sim };
			});
		},

		/**
		 * Update allRulesets with new priorities after a successful save.
		 * This keeps local state in sync so hasSimulationChanges resets correctly.
		 */
		applyPriorityChanges: (changes: Array<{ id: number; priority: number }>) => {
			update(state => {
				const updatedRulesets = state.allRulesets.map(rs => {
					const change = changes.find(c => c.id === rs.id);
					if (change) {
						return { ...rs, priority: change.priority };
					}
					return rs;
				});
				const sim = initSimulation(updatedRulesets);
				// Preserve sentinel entry
				const sentinel = state.simulation.get(NEW_RULESET_SENTINEL_ID);
				if (sentinel) {
					sim.set(NEW_RULESET_SENTINEL_ID, sentinel);
				}
				return {
					...state,
					allRulesets: updatedRulesets,
					simulation: sim
				};
			});
		},

		/** Clear all coverage data and cancel pending debounce */
		clear: () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
			set(initialState);
		}
	};
}

export const coverageStore = createCoverageStore();

// ─── Derived stores ──────────────────────────────────────────────

/** Count of items covered by other rulesets */
export const coveredItemCount = derived(coverageStore, ($c) => $c.coverageMap.size);

/** Whether coverage evaluation is in progress */
export const isEvaluatingCoverage = derived(coverageStore, ($c) => $c.isEvaluating);

/** Whether simulation differs from actual priorities (ignores new/unsaved rulesets) */
export const hasSimulationChanges = derived(coverageStore, ($c) => {
	for (const [id, sim] of $c.simulation) {
		if (id === NEW_RULESET_SENTINEL_ID) continue; // new ruleset has no saved priority
		const original = $c.allRulesets.find(r => r.id === id);
		if (original && sim.simulatedPriority !== original.priority) {
			return true;
		}
	}
	return false;
});

/** Simulated rulesets sorted by priority (reactive) */
export const simulatedRulesets = derived(coverageStore, ($c): SimulatedRuleset[] => {
	return [...$c.simulation.values()].sort(
		(a, b) => a.simulatedPriority - b.simulatedPriority
	);
});

/** The current ruleset's simulated priority */
export const currentSimulatedPriority = derived(coverageStore, ($c): number => {
	if ($c.currentRulesetId == null) return 0;
	const sim = $c.simulation.get($c.currentRulesetId);
	return sim ? sim.simulatedPriority : 0;
});

/**
 * A stable key that changes when simulation state changes.
 * Used as a dependency trigger for re-evaluating coverage.
 */
export const simulationKey = derived(coverageStore, ($c): string => {
	const parts: string[] = [];
	// Sort by ID for stable key generation
	const sorted = [...$c.simulation.values()].sort((a, b) => a.id - b.id);
	for (const sim of sorted) {
		parts.push(`${sim.id}:${sim.enabled ? '1' : '0'}:${sim.simulatedPriority}`);
	}
	return parts.join('|');
});
