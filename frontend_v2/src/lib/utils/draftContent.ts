import type { Ruleset } from '$types';
import type { SuggestionChange, SuggestionRevision } from '$types/suggestion';
import { toRulesetBody } from '$api/suggestions';

export interface DraftContent {
	description: string;
	changes: SuggestionChange[];
	order: string[] | null;
}

export interface ProposalDraftSource extends DraftContent {
	baseRevision: number | null;
	/** Content of `baseRevision` as stored on the server. */
	saved: DraftContent | null;
}

export type ProposalDraftResolution = 'load' | 'resume' | 'conflict';

export function savedContent(revision: Pick<SuggestionRevision, 'description' | 'bundle'>): DraftContent {
	return {
		description: revision.description,
		order: revision.bundle.order,
		changes: revision.bundle.changes.map((c) => ({ ...c, snapshot: null }))
	};
}

export function nextTempKey(changes: SuggestionChange[]): string {
	const used = new Set(changes.map((c) => c.key));
	let n = 1;
	while (used.has(`c${n}`)) n++;
	return `c${n}`;
}

export function dropRef(order: string[] | null, ref: string): string[] | null {
	return order ? order.filter((r) => r !== ref) : null;
}

/** Live order without deleted rulesets, staged creates appended. */
export function defaultOrder(content: Pick<DraftContent, 'changes'>, liveRulesets: Ruleset[]): string[] {
	const deleted = new Set(
		content.changes.filter((c) => c.op === 'delete').map((c) => c.rulesetId)
	);
	const kept = [...liveRulesets]
		.sort((a, b) => a.priority - b.priority)
		.filter((r) => r.id != null && !deleted.has(r.id))
		.map((r) => String(r.id));
	const creates = content.changes.filter((c) => c.op === 'create').map((c) => c.key);
	return [...kept, ...creates];
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
	}
	return JSON.stringify(value ?? null);
}

function canonicalChange(change: SuggestionChange) {
	return {
		key: change.key,
		op: change.op,
		rulesetId: change.rulesetId ?? null,
		base: change.base
			? { id: change.base.ruleset.id, ruleset: toRulesetBody(change.base.ruleset) }
			: null,
		ruleset: change.ruleset ? toRulesetBody(change.ruleset) : null
	};
}

function contentSignature(content: DraftContent, liveRulesets: Ruleset[]): string {
	return stableStringify({
		description: content.description,
		order: content.order ?? defaultOrder(content, liveRulesets),
		changes: content.changes
			.map(canonicalChange)
			.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
	});
}

export function sameDraftContent(a: DraftContent, b: DraftContent, liveRulesets: Ruleset[]): boolean {
	return contentSignature(a, liveRulesets) === contentSignature(b, liveRulesets);
}

export function hasUnsavedEdits(draft: ProposalDraftSource, liveRulesets: Ruleset[]): boolean {
	return draft.saved === null || !sameDraftContent(draft, draft.saved, liveRulesets);
}

/** How to open an open proposal for editing, given the locally stored draft. */
export function resolveProposalDraft(
	local: ProposalDraftSource | null,
	currentRevision: number,
	liveRulesets: Ruleset[],
	afterConflict: boolean
): ProposalDraftResolution {
	if (!local?.saved || local.baseRevision === null) return 'load';
	if (!hasUnsavedEdits(local, liveRulesets)) return 'load';
	if (!afterConflict && local.baseRevision === currentRevision) return 'resume';
	return 'conflict';
}

/** Add `source` changes to `target`; creates get fresh temp keys, ruleset changes replace target's. */
export function mergeChanges(target: DraftContent, source: DraftContent): DraftContent {
	const changes = [...target.changes];
	let order = target.order;

	for (const change of source.changes) {
		if (change.op === 'create') {
			const key = nextTempKey(changes);
			changes.push({ ...change, key });
			if (order) order = [...order, key];
			continue;
		}
		const index = changes.findIndex((c) => c.rulesetId === change.rulesetId);
		if (index >= 0) {
			changes[index] = { ...change, key: changes[index].key };
		} else {
			changes.push(change);
		}
		if (change.op === 'delete') order = dropRef(order, String(change.rulesetId));
	}

	return {
		description: target.description || source.description,
		changes,
		order
	};
}
