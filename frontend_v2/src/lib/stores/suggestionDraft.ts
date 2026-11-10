/**
 * Suggestion Draft Store
 * A localStorage-persisted bundle of staged ruleset changes, one draft per key.
 */

import { writable, derived } from 'svelte/store';
import type { MediaType, Ruleset } from '$types';
import type {
	BundleCoverage,
	ChangeCounts,
	ChangeSnapshot,
	ProposedMedia,
	RulesetBody,
	StaleEntry,
	SuggestionBundle,
	SuggestionChange,
	SuggestionRevision
} from '$types/suggestion';
import { toBaseRuleset, toRuleset, toRulesetBody } from '$api/suggestions';
import {
	defaultOrder,
	dropRef,
	mergeChanges,
	nextTempKey,
	reinsertRef,
	savedContent,
	type DraftContent
} from '$utils/draftContent';

const STORAGE_PREFIX = 'mediathekarr:draft:';

/** Lowest synthetic id handed to a staged create (real ids are positive). */
const FIRST_SYNTHETIC_ID = -2;

export type DraftKey = string;

export function mediaDraftKey(mediaId: number): DraftKey {
	return `media:${mediaId}`;
}

export function newMediaDraftKey(media: {
	type: MediaType;
	name: string;
	tvdbId?: number | null;
	tmdbId?: number | null;
}): DraftKey {
	const ref = (media.type === 'show' ? media.tvdbId : media.tmdbId) ?? media.name;
	return `newmedia:${media.type}:${ref}`;
}

export function suggestionDraftKey(suggestionId: number): DraftKey {
	return `suggestion:${suggestionId}`;
}

export interface DraftInit {
	mediaId?: number | null;
	proposedMedia?: ProposedMedia | null;
	suggestionId?: number | null;
	forkedFromId?: number | null;
	description?: string;
}

export interface SuggestionDraftState {
	key: DraftKey;
	mediaId: number | null;
	proposedMedia: ProposedMedia | null;
	suggestionId: number | null;
	/** Proposal this draft was copied from; sent with the new proposal. */
	forkedFromId: number | null;
	/** Revision of the open proposal this draft edits; the server rejects a save once it is outdated. */
	baseRevision: number | null;
	/** Content of `baseRevision` as stored on the server. */
	saved: DraftContent | null;
	description: string;
	changes: SuggestionChange[];
	order: string[] | null;
	coverage: BundleCoverage | null;
	stale: StaleEntry[];
}

const emptyState: SuggestionDraftState = {
	key: '',
	mediaId: null,
	proposedMedia: null,
	suggestionId: null,
	forkedFromId: null,
	baseRevision: null,
	saved: null,
	description: '',
	changes: [],
	order: null,
	coverage: null,
	stale: []
};

// ─── Persistence ─────────────────────────────────────────────────

function storageKey(key: DraftKey): string {
	return `${STORAGE_PREFIX}${key}`;
}

function readDraft(key: DraftKey): SuggestionDraftState | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(storageKey(key));
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<SuggestionDraftState>;
		if (!Array.isArray(parsed.changes)) return null;
		return { ...emptyState, ...parsed, key };
	} catch {
		return null;
	}
}

function writeDraft(state: SuggestionDraftState): void {
	if (typeof localStorage === 'undefined' || !state.key) return;
	localStorage.setItem(storageKey(state.key), JSON.stringify(state));
}

function removeDraft(key: DraftKey): void {
	if (typeof localStorage === 'undefined' || !key) return;
	localStorage.removeItem(storageKey(key));
}

// ─── Pure helpers ────────────────────────────────────────────────

function changeForRuleset(
	state: SuggestionDraftState,
	rulesetId: number
): SuggestionChange | undefined {
	return state.changes.find((c) => c.rulesetId === rulesetId);
}

/** Synthetic negative ids for staged creates, in change order. */
function syntheticIds(state: SuggestionDraftState): Map<string, number> {
	const map = new Map<string, number>();
	let id = FIRST_SYNTHETIC_ID;
	for (const change of state.changes) {
		if (change.op === 'create') map.set(change.key, id--);
	}
	return map;
}

function effectiveList(state: SuggestionDraftState, liveRulesets: Ruleset[]): Ruleset[] {
	const ids = syntheticIds(state);
	const byRef = new Map<string, Ruleset>();

	for (const live of liveRulesets) {
		if (live.id == null) continue;
		const change = changeForRuleset(state, live.id);
		if (change?.op === 'delete') continue;
		if (change?.op === 'update' && change.ruleset) {
			byRef.set(
				String(live.id),
				toRuleset(change.ruleset, {
					id: live.id,
					mediaId: live.mediaId,
					priority: live.priority
				})
			);
		} else {
			byRef.set(String(live.id), live);
		}
	}

	for (const change of state.changes) {
		if (change.op !== 'create' || !change.ruleset) continue;
		byRef.set(
			change.key,
			toRuleset(change.ruleset, {
				id: ids.get(change.key),
				mediaId: state.mediaId ?? undefined,
				priority: 0
			})
		);
	}

	const order = state.order ?? defaultOrder(state, liveRulesets);
	const seen = new Set<string>();
	const result: Ruleset[] = [];

	for (const ref of order) {
		const ruleset = byRef.get(ref);
		if (ruleset && !seen.has(ref)) {
			seen.add(ref);
			result.push(ruleset);
		}
	}
	for (const [ref, ruleset] of byRef) {
		if (!seen.has(ref)) result.push(ruleset);
	}

	return result.map((ruleset, index) => ({ ...ruleset, priority: index }));
}

function upsert(
	state: SuggestionDraftState,
	change: SuggestionChange
): SuggestionDraftState {
	const changes = [...state.changes];
	const existing =
		change.rulesetId != null
			? changes.findIndex((c) => c.rulesetId === change.rulesetId)
			: changes.findIndex((c) => c.key === change.key);

	if (existing >= 0) {
		changes[existing] = change;
	} else {
		changes.push(change);
	}

	return {
		...state,
		changes,
		stale: state.stale.filter((s) => s.key !== change.key)
	};
}

function fromRevision(
	key: DraftKey,
	revision: SuggestionRevision,
	init: DraftInit
): SuggestionDraftState {
	return {
		...emptyState,
		key,
		mediaId: init.mediaId ?? null,
		proposedMedia: init.proposedMedia ?? null,
		suggestionId: init.suggestionId ?? null,
		forkedFromId: init.forkedFromId ?? null,
		baseRevision: init.suggestionId ? revision.number : null,
		saved: init.suggestionId ? savedContent(revision) : null,
		description: revision.description,
		changes: revision.bundle.changes.map((c) => ({ ...c })),
		order: revision.bundle.order,
		coverage: revision.bundle.coverage,
		stale: []
	};
}

// ─── Store ───────────────────────────────────────────────────────

function createSuggestionDraftStore() {
	const { subscribe, set, update } = writable<SuggestionDraftState>(emptyState);

	let current = emptyState;
	subscribe((state) => {
		current = state;
	});

	function commit(next: SuggestionDraftState): SuggestionDraftState {
		writeDraft(next);
		return next;
	}

	return {
		subscribe,

		/** Current snapshot without subscribing. */
		get: (): SuggestionDraftState => current,

		exists: (key: DraftKey): boolean => readDraft(key) !== null,

		/** The persisted draft for `key`, without opening it. */
		peek: (key: DraftKey): SuggestionDraftState | null => readDraft(key),

		/** Load the persisted draft for `key`, or start a fresh one from `init`. */
		open: (key: DraftKey, init: DraftInit = {}): SuggestionDraftState => {
			const stored = readDraft(key);
			const next: SuggestionDraftState = stored
				? {
						...stored,
						...(init.suggestionId != null ? { suggestionId: init.suggestionId } : {})
					}
				: {
						...emptyState,
						key,
						mediaId: init.mediaId ?? null,
						proposedMedia: init.proposedMedia ?? null,
						suggestionId: init.suggestionId ?? null,
						forkedFromId: init.forkedFromId ?? null,
						description: init.description ?? ''
					};
			set(next);
			return next;
		},

		setDescription: (description: string) => {
			update((state) => commit({ ...state, description }));
		},

		setCoverage: (coverage: BundleCoverage | null) => {
			update((state) => commit({ ...state, coverage }));
		},

		/** Keep the local changes on top of `revision`, overwriting what was saved in between. */
		adoptRevision: (revision: SuggestionRevision) => {
			update((state) =>
				commit({
					...state,
					baseRevision: revision.number,
					saved: savedContent(revision)
				})
			);
		},

		stageUpdate: (
			ruleset: RulesetBody | Ruleset,
			base: Ruleset,
			snapshot: ChangeSnapshot | null,
			order?: string[]
		) => {
			update((state) => {
				if (base.id == null) return state;
				const existing = changeForRuleset(state, base.id);
				const next = upsert(state, {
					key: existing?.key ?? `r${base.id}`,
					op: 'update',
					rulesetId: base.id,
					base: { ruleset: toBaseRuleset(base) },
					ruleset: toRulesetBody(ruleset),
					snapshot
				});
				return commit({ ...next, order: order ?? next.order });
			});
		},

		stageCreate: (
			body: RulesetBody | Ruleset,
			snapshot: ChangeSnapshot | null,
			tempKey?: string,
			order?: string[]
		): string => {
			let key = tempKey ?? '';
			update((state) => {
				key = tempKey ?? nextTempKey(state.changes);
				const next = upsert(state, { key, op: 'create', ruleset: toRulesetBody(body), snapshot });
				if (order) return commit({ ...next, order });
				const appended = next.order && !next.order.includes(key) ? [...next.order, key] : next.order;
				return commit({ ...next, order: appended });
			});
			return key;
		},

		/** A delete replaces any staged update for the same ruleset. */
		stageDelete: (ruleset: Ruleset, snapshot: ChangeSnapshot | null) => {
			update((state) => {
				if (ruleset.id == null) return state;
				const existing = changeForRuleset(state, ruleset.id);
				const next = upsert(state, {
					key: existing?.key ?? `r${ruleset.id}`,
					op: 'delete',
					rulesetId: ruleset.id,
					base: { ruleset: toBaseRuleset(ruleset) },
					snapshot
				});
				return commit({ ...next, order: dropRef(next.order, String(ruleset.id)) });
			});
		},

		/** Drop a staged change by its change key. */
		unstage: (key: string) => {
			update((state) => {
				const change = state.changes.find((c) => c.key === key);
				if (!change) return state;
				return commit({
					...state,
					changes: state.changes.filter((c) => c.key !== key),
					order: change.op === 'create' ? dropRef(state.order, key) : state.order,
					stale: state.stale.filter((s) => s.key !== key)
				});
			});
		},

		/** Undo a staged delete (or update) for a live ruleset. */
		restore: (rulesetId: number, liveRulesets: Ruleset[] = []) => {
			update((state) => {
				const change = changeForRuleset(state, rulesetId);
				if (!change) return state;
				return commit({
					...state,
					changes: state.changes.filter((c) => c.rulesetId !== rulesetId),
					order: reinsertRef(state.order, rulesetId, liveRulesets),
					stale: state.stale.filter((s) => s.key !== change.key)
				});
			});
		},

		setOrder: (order: string[] | null) => {
			update((state) => commit({ ...state, order }));
		},

		/** Back to live order with staged creates appended. */
		resetOrder: () => {
			update((state) => commit({ ...state, order: null }));
		},

		isOrderDefault: (liveRulesets: Ruleset[]): boolean => {
			if (current.order === null) return true;
			const def = defaultOrder(current, liveRulesets);
			return current.order.length === def.length && current.order.every((r, i) => r === def[i]);
		},

		/** Live rulesets with the bundle and order applied; creates get negative ids. */
		effectiveRulesets: (liveRulesets: Ruleset[]): Ruleset[] => effectiveList(current, liveRulesets),

		/** Synthetic create id → temp change key. */
		tempKeyById: (): Map<number, string> => {
			const map = new Map<number, string>();
			for (const [key, id] of syntheticIds(current)) map.set(id, key);
			return map;
		},

		syntheticIdFor: (tempKey: string): number | undefined => syntheticIds(current).get(tempKey),

		/** Replace the draft with a server revision of an existing proposal. */
		loadFromRevision: (
			suggestionId: number,
			revision: SuggestionRevision,
			init: DraftInit = {}
		): SuggestionDraftState => {
			const next = fromRevision(suggestionDraftKey(suggestionId), revision, {
				...init,
				suggestionId
			});
			set(commit(next));
			return next;
		},

		/** Copy a server revision into a fresh draft at `key` — a fork, not a revision. */
		forkFromRevision: (
			key: DraftKey,
			revision: SuggestionRevision,
			init: DraftInit = {}
		): SuggestionDraftState => {
			const next = fromRevision(key, revision, { ...init, suggestionId: null });
			set(commit(next));
			return next;
		},

		/** Merge this draft's changes into the draft at `other`, then open it. */
		mergeInto: (other: DraftKey, liveRulesets: Ruleset[]): SuggestionDraftState => {
			const source = current;
			const stored = readDraft(other) ?? { ...emptyState, key: other };
			const target = { ...stored, ...mergeChanges(stored, source, liveRulesets), coverage: null };

			removeDraft(source.key);
			set(commit(target));
			return target;
		},

		/** Re-base a change onto the current live ruleset and clear its stale mark. */
		rebaseChange: (key: string, liveRuleset: Ruleset, snapshot: ChangeSnapshot | null) => {
			update((state) => {
				const changes = state.changes.map((c) =>
					c.key === key
						? {
								...c,
								rulesetId: liveRuleset.id ?? c.rulesetId,
								base: { ruleset: toBaseRuleset(liveRuleset) },
								snapshot
							}
						: c
				);
				return commit({
					...state,
					changes,
					stale: state.stale.filter((s) => s.key !== key)
				});
			});
		},

		markStale: (stale: StaleEntry[]) => {
			update((state) => commit({ ...state, stale }));
		},

		/** The payload sent to the API — `base` carries the ruleset, never the hash. */
		toBundle: (): SuggestionBundle => ({
			changes: current.changes.map((change) => ({
				key: change.key,
				op: change.op,
				...(change.rulesetId != null ? { rulesetId: change.rulesetId } : {}),
				...(change.base ? { base: { ruleset: change.base.ruleset } } : {}),
				...(change.ruleset ? { ruleset: change.ruleset } : {}),
				snapshot: change.snapshot ?? null
			})),
			order: current.order,
			coverage: current.coverage
		}),

		/** Forget the open draft in memory; the persisted copy stays. */
		close: () => {
			set(emptyState);
		},

		clear: () => {
			removeDraft(current.key);
			set(emptyState);
		}
	};
}

export const suggestionDraft = createSuggestionDraftStore();

// ─── Derived stores ──────────────────────────────────────────────

export const draftChangeCounts = derived(suggestionDraft, ($d): ChangeCounts => {
	const counts: ChangeCounts = { create: 0, update: 0, delete: 0 };
	for (const change of $d.changes) counts[change.op]++;
	return counts;
});

export const draftStaleKeys = derived(
	suggestionDraft,
	($d) => new Set($d.stale.map((s) => s.key).filter((k): k is string => k !== null))
);
