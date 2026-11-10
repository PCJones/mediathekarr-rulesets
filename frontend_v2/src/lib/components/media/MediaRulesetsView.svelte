<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { createRuleset, updateRuleset, deleteRuleset, reorderRulesets } from '$api/rulesets';
	import {
		createSuggestion,
		getStaleFromError,
		isRevisionChangedError,
		getSuggestion,
		getSuggestionRevision,
		getSuggestionsForMedia,
		reviseSuggestion,
		toBaseRuleset,
		toRuleset
	} from '$api/suggestions';
	import { authStore, isAdmin } from '$stores/auth';
	import {
		mediaDraftKey,
		suggestionDraft,
		suggestionDraftKey,
		draftChangeCounts,
		draftStaleKeys
	} from '$stores/suggestionDraft';
	import { hasUnsavedEdits, nextTempKey, resolveProposalDraft } from '$utils/draftContent';
	import { NEW_RULESET_SENTINEL_ID } from '$stores/coverage';
	import {
		collectItems,
		computeBundleCoverage,
		computeEpisodeCoverage,
		splitTopics,
		type RulesetEpisodeCoverage,
		fetchItemsForTopics,
		getChangeSnapshot
	} from '$utils/coverage';
	import type { Media, MediathekItem, Ruleset, DurationInfo, TvdbShowData } from '$types';
	import type {
		ChangeSnapshot,
		MediaSuggestions,
		ProposedMedia,
		SuggestionChange,
		SuggestionDetail,
		SuggestionSummary
	} from '$types/suggestion';
	import WizardBuilder from '$components/wizard/WizardBuilder.svelte';
	import RulesetRow from '$components/rulesets/RulesetRow.svelte';
	import RulesetFacet from '$components/rulesets/RulesetFacet.svelte';
	import { FACET_LABELS, gridColumns, splitFacets } from '$utils/rulesetFacets';
	import RulesetDiff from '$components/suggestions/RulesetDiff.svelte';
	import ChangeChips from '$components/suggestions/ChangeChips.svelte';
	import DraftBar from '$components/suggestions/DraftBar.svelte';
	import SubmitDialog from '$components/suggestions/SubmitDialog.svelte';
	import Button from '$components/ui/Button.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Alert from '$components/ui/Alert.svelte';

	interface Props {
		media: Media;
		liveRulesets: Ruleset[];
		durationInfo?: DurationInfo | null;
		tvdbShowData?: TvdbShowData | null;
		/** New-media proposal: the media does not exist yet, draft mode is always on. */
		proposedMedia?: ProposedMedia | null;
		/** localStorage draft key; defaults to `media:<id>`. */
		draftKey?: string;
		/** Reload the live rulesets after a direct (admin) save. */
		onReload?: () => Promise<void>;
	}

	let {
		media,
		liveRulesets,
		durationInfo = null,
		tvdbShowData = null,
		proposedMedia = null,
		draftKey,
		onReload
	}: Props = $props();

	let baseKey = $derived(draftKey ?? mediaDraftKey(media.id));
	let role = $derived($isAdmin ? 'admin' : $authStore.isAuthenticated ? 'user' : 'guest');
	/** Admins save directly, except while they edit an existing proposal. */
	let proposalMode = $state(false);
	let usesDraft = $derived(
		proposedMedia ? role !== 'guest' : role === 'user' || proposalMode
	);
	let tvdbEpisodes = $derived(tvdbShowData?.episodes ?? []);
	/** Regular TVDB episodes aired up to 8 days from now; specials (season 0) excluded. */
	let tvdbEpisodeCount = $derived.by(() => {
		const limit = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		return tvdbEpisodes.filter((e) => e.seasonNumber > 0 && e.aired && e.aired.slice(0, 10) <= limit)
			.length;
	});

	let error = $state<string | null>(null);
	let busy = $state(false);

	let draft = $derived($suggestionDraft);
	let draftActive = $derived(draft.key !== '');
	let counts = $derived($draftChangeCounts);
	let staleKeys = $derived($draftStaleKeys);
	let suggestionId = $derived(draft.suggestionId);
	let revision = $derived(draft.baseRevision);
	let unsavedEdits = $derived(hasUnsavedEdits(draft, liveRulesets));

	let showWizard = $state(false);
	let editingRuleset = $state<Ruleset | null>(null);
	let editingBase = $state<Ruleset | null>(null);
	let editingChangeKey = $state<string | null>(null);
	let rebaseFrom = $state<Ruleset | null>(null);
	let showRebaseDiff = $state(false);
	let viewDetail = $state<SuggestionDetail | null>(null);

	let submitOpen = $state(false);
	let submitDescription = $state('');
	let isSubmitting = $state(false);
	let submitError = $state<string | null>(null);

	let existsNote = $state(false);
	let coverageLoading = $state(false);
	let mediaSuggestions = $state<MediaSuggestions | null>(null);
	let suggestionsPromise: Promise<unknown> | null = null;

	let sortedLive = $derived([...liveRulesets].sort((a, b) => a.priority - b.priority));

	let effective = $derived.by(() => {
		void draft;
		if (!draftActive) return sortedLive;
		return suggestionDraft.effectiveRulesets(liveRulesets);
	});

	let tempKeys = $derived.by(() => {
		void draft;
		return suggestionDraft.tempKeyById();
	});

	let orderIsDefault = $derived.by(() => {
		void draft;
		return suggestionDraft.isOrderDefault(liveRulesets);
	});

	function changeFor(ruleset: Ruleset): SuggestionChange | null {
		if (!draftActive || ruleset.id == null) return null;
		if (ruleset.id < 0) {
			const key = tempKeys.get(ruleset.id);
			return draft.changes.find((c) => c.key === key) ?? null;
		}
		return draft.changes.find((c) => c.rulesetId === ruleset.id) ?? null;
	}

	interface Tile {
		ruleset: Ruleset;
		position: number;
		change: SuggestionChange | null;
		deleted: boolean;
	}

	let tiles = $derived.by((): Tile[] => {
		const list: Tile[] = effective.map((ruleset, index) => ({
			ruleset,
			position: index + 1,
			change: changeFor(ruleset),
			deleted: false
		}));
		if (draftActive) {
			const deletes = draft.changes.filter((c) => c.op === 'delete' && c.base);
			deletes.forEach((change, index) => {
				list.push({
					ruleset: toRuleset(change.base!.ruleset),
					position: effective.length + index + 1,
					change,
					deleted: true
				});
			});
		}
		return list;
	});

	let facetSplit = $derived(splitFacets(tiles.map((t) => t.ruleset)));

	// ─── Per-ruleset coverage (first match wins) ─────────────────

	let rowCoverage = $state<{
		perRuleset: Map<number, RulesetEpisodeCoverage>;
		max: number;
		total: number;
	} | null>(null);
	let rowCoverageLoading = $state(false);
	let itemsCache: { key: string; items: MediathekItem[] } | null = null;

	let rowCoverageSignature = $derived(
		JSON.stringify([
			effective.map((r) => [
				r.id,
				r.topic,
				r.filters,
				r.titleRegexRules,
				r.matchingStrategy,
				r.seasonRegex,
				r.episodeRegex
			]),
			tvdbEpisodes.length
		])
	);

	$effect(() => {
		const signature = rowCoverageSignature;
		untrack(() => recomputeRowCoverage(signature));
	});

	function coverageFor(ruleset: Ruleset) {
		const coverage = ruleset.id != null ? rowCoverage?.perRuleset.get(ruleset.id) : undefined;
		if (!coverage) return null;
		const positionOf = new Map(effective.map((r, i) => [r.id, i + 1]));
		return {
			found: coverage.found,
			unknown: coverage.unknown,
			shadowedBy: [...coverage.shadowedBy].map(([id, count]) => ({
				position: positionOf.get(id) ?? 0,
				count
			}))
		};
	}

	async function recomputeRowCoverage(signature: string) {
		const rulesets = effective;
		if (rulesets.length === 0) {
			rowCoverage = null;
			return;
		}
		const topics = rulesets.map((r) => r.topic);
		const topicKey = [...new Set(topics.flatMap(splitTopics))].sort().join('|');
		rowCoverageLoading = true;
		try {
			if (itemsCache?.key !== topicKey) {
				const byTopic = await fetchItemsForTopics(topics);
				if (signature !== rowCoverageSignature) return;
				const seen = new Set<string>();
				const items: MediathekItem[] = [];
				for (const topic of topics) {
					for (const item of collectItems(topic, byTopic)) {
						if (seen.has(item.id)) continue;
						seen.add(item.id);
						items.push(item);
					}
				}
				itemsCache = { key: topicKey, items };
			}
			const ordered = rulesets.map((r, priority) => ({ ...r, priority }));
			const result = computeEpisodeCoverage(itemsCache.items, ordered, tvdbEpisodes);
			rowCoverage = {
				perRuleset: result.perRuleset,
				max: Math.max(0, ...[...result.perRuleset.values()].map((c) => c.found)),
				total: result.total
			};
		} catch {
			if (signature === rowCoverageSignature) rowCoverage = null;
		} finally {
			if (signature === rowCoverageSignature) rowCoverageLoading = false;
		}
	}

	/** Open proposals other than the one being edited. */
	let otherOpen = $derived((mediaSuggestions?.open ?? []).filter((s) => s.id !== suggestionId));

	let touchedBy = $derived.by(() => {
		const map = new Map<number, number[]>();
		for (const s of otherOpen) {
			for (const id of s.touchedRulesetIds ?? []) {
				map.set(id, [...(map.get(id) ?? []), s.id]);
			}
		}
		return map;
	});

	function proposalBadge(ruleset: Ruleset) {
		if (ruleset.id == null || ruleset.id < 0) return null;
		const ids = touchedBy.get(ruleset.id);
		if (!ids || ids.length === 0) return null;
		return ids.length === 1
			? { label: `Vorschlag #${ids[0]}`, href: `/suggestions/${ids[0]}` }
			: { label: `${ids.length} Vorschläge`, href: `/suggestions?mediaId=${media.id}` };
	}

	let staleCount = $derived(draft.changes.filter((c) => staleKeys.has(c.key)).length);
	let submitBlocked = $derived(
		staleCount > 0 ? `${staleCount} Änderung${staleCount === 1 ? '' : 'en'} veraltet` : null
	);

	// ─── Init & deep links ───────────────────────────────────────

	let initedFor: string | null = null;

	$effect(() => {
		const key = `${media.id}:${baseKey}`;
		if (initedFor === key) return;
		initedFor = key;
		untrack(() => init());
	});

	onDestroy(() => suggestionDraft.close());

	async function init() {
		showWizard = false;
		editingRuleset = null;
		editingBase = null;
		editingChangeKey = null;
		rebaseFrom = null;
		viewDetail = null;
		suggestionDraft.close();
		proposalMode = false;
		error = null;

		if (media.id > 0) {
			suggestionsPromise = loadSuggestions();
		}

		const params = $page.url.searchParams;
		existsNote = params.get('exists') === '1';
		const viewParam = params.get('view');
		const draftParam = params.get('draft');
		const changeParam = params.get('change');

		if (viewParam?.startsWith('suggestion:')) {
			await openViewMode(Number(viewParam.slice('suggestion:'.length)), changeParam);
			return;
		}

		if (draftParam === '1' && role !== 'guest') proposalMode = true;

		if (draftParam?.startsWith('suggestion:') && role !== 'guest') {
			await openProposalDraft(Number(draftParam.slice('suggestion:'.length)), changeParam);
		} else if (proposedMedia) {
			suggestionDraft.open(baseKey, { proposedMedia });
		} else if (usesDraft) {
			await resumeDraft();
			if (!draftActive && draftParam === '1') await enterDraft();
		}

		if (!showWizard && role !== 'guest' && liveRulesets.length === 0 && draft.changes.length === 0) {
			if (usesDraft && !(await enterDraft())) return;
			startAddNew();
		}
	}

	async function loadSuggestions() {
		try {
			mediaSuggestions = await getSuggestionsForMedia(media.id);
		} catch {
			mediaSuggestions = null;
		}
	}

	/** Local edits for a media with an own open proposal always go through that proposal. */
	async function resumeDraft() {
		const hasMediaDraft = suggestionDraft.exists(baseKey);
		if (suggestionsPromise) await suggestionsPromise;
		const mine = mediaSuggestions?.mine;
		if (!mine) {
			if (hasMediaDraft) suggestionDraft.open(baseKey, { mediaId: media.id });
			return;
		}
		const stored = suggestionDraft.peek(suggestionDraftKey(mine.id));
		if (hasMediaDraft || (stored && hasUnsavedEdits(stored, liveRulesets))) {
			await openProposalDraft(mine.id, null);
		}
	}

	async function enterDraft(): Promise<boolean> {
		if (draftActive) return true;
		if (suggestionsPromise) await suggestionsPromise;
		const mine = mediaSuggestions?.mine;
		if (mine && !proposedMedia) return await openProposalDraft(mine.id, null);
		suggestionDraft.open(baseKey, { mediaId: media.id > 0 ? media.id : null, proposedMedia });
		return true;
	}

	async function openProposalDraft(
		id: number,
		changeKey: string | null,
		afterConflict = false
	): Promise<boolean> {
		try {
			const detail = await getSuggestion(id);
			const userId = $authStore.user?.id;
			if (!$isAdmin && detail.author.id !== userId) {
				await goto(`/suggestions/${id}?note=nur-autor`);
				return false;
			}
			if (detail.status !== 'open') {
				await goto(`/suggestions/${id}`);
				return false;
			}

			const key = suggestionDraftKey(id);
			const resolution = resolveProposalDraft(
				suggestionDraft.peek(key),
				detail.currentRevision,
				liveRulesets,
				afterConflict
			);
			const keepLocal =
				resolution === 'resume' ||
				(resolution === 'conflict' &&
					!confirm(
						`Jemand hat diesen Vorschlag inzwischen gespeichert (jetzt Revision ${detail.currentRevision}). Neuen Stand laden und deine Änderungen verwerfen? Abbrechen behält deine Änderungen und überschreibt den neuen Stand beim Speichern.`
					));

			const rev = await getSuggestionRevision(id, detail.currentRevision);
			if (keepLocal) {
				suggestionDraft.open(key, { mediaId: media.id, suggestionId: id });
				suggestionDraft.adoptRevision(rev);
			} else {
				suggestionDraft.loadFromRevision(id, rev, { mediaId: detail.media?.id ?? media.id });
			}

			const localKey = mediaDraftKey(media.id);
			if (media.id > 0 && suggestionDraft.exists(localKey)) {
				const merge = confirm(
					`Du hast lokale Änderungen für ${forThisMedia}. In den Vorschlag übernehmen? Abbrechen verwirft sie.`
				);
				suggestionDraft.open(localKey);
				if (merge) {
					suggestionDraft.mergeInto(key, liveRulesets);
				} else {
					suggestionDraft.clear();
					suggestionDraft.open(key);
				}
			}

			suggestionDraft.markStale(detail.stale ?? []);
			proposalMode = true;
			if (changeKey) openChange(changeKey, (detail.stale ?? []).some((s) => s.key === changeKey));
			return true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Vorschlag konnte nicht geladen werden';
			return false;
		}
	}

	async function openViewMode(id: number, changeKey: string | null) {
		try {
			const detail = await getSuggestion(id);
			const change =
				detail.bundle.changes.find((c) => c.key === changeKey) ?? detail.bundle.changes[0];
			if (!change) return;
			viewDetail = detail;
			editingRuleset = change.ruleset
				? toRuleset(change.ruleset, { id: change.rulesetId, priority: 0 })
				: change.base
					? toRuleset(change.base.ruleset)
					: null;
			editingBase = null;
			editingChangeKey = change.key;
			showWizard = true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Vorschlag konnte nicht geladen werden';
		}
	}

	function openChange(key: string, rebase: boolean) {
		const change = draft.changes.find((c) => c.key === key);
		if (!change || change.op === 'delete') return;

		if (change.op === 'create') {
			editingRuleset = toRuleset(change.ruleset!, {
				id: suggestionDraft.syntheticIdFor(key),
				mediaId: media.id > 0 ? media.id : undefined,
				priority: 0
			});
			editingBase = null;
		} else {
			const live = liveRulesets.find((r) => r.id === change.rulesetId) ?? null;
			editingRuleset = toRuleset(change.ruleset!, {
				id: change.rulesetId,
				mediaId: media.id,
				priority: live?.priority ?? 0
			});
			editingBase = live;
			rebaseFrom = rebase && change.base ? toRuleset(change.base.ruleset) : null;
		}
		editingChangeKey = key;
		showWizard = true;
	}

	// ─── Tile actions ────────────────────────────────────────────

	function startAddNew() {
		editingRuleset = null;
		editingBase = null;
		editingChangeKey = null;
		rebaseFrom = null;
		showWizard = true;
	}

	async function startEdit(tile: Tile) {
		if (role === 'guest') return;
		if (tile.change && draftActive) {
			openChange(tile.change.key, false);
			return;
		}
		if (usesDraft && !(await enterDraft())) return;
		editingRuleset = tile.ruleset;
		editingBase = tile.ruleset.id != null && tile.ruleset.id > 0 ? tile.ruleset : null;
		editingChangeKey = null;
		rebaseFrom = null;
		showWizard = true;
	}

	async function handleDuplicate(ruleset: Ruleset) {
		const maxPriority = Math.max(...effective.map((r) => r.priority), 0);
		const cloned = { ...ruleset, id: undefined, priority: maxPriority + 1 };

		if (!usesDraft) {
			try {
				await createRuleset(cloned as Omit<Ruleset, 'id'>);
				await onReload?.();
			} catch (e) {
				error = e instanceof Error ? e.message : 'Fehler beim Duplizieren';
			}
			return;
		}

		if (!(await enterDraft())) return;
		editingRuleset = cloned as Ruleset;
		editingBase = null;
		editingChangeKey = null;
		rebaseFrom = null;
		showWizard = true;
	}

	async function handleDelete(ruleset: Ruleset) {
		if (!usesDraft) {
			if (!confirm(`Ruleset "${ruleset.topic}" wirklich löschen?`)) return;
			try {
				await deleteRuleset(ruleset.id!);
				await onReload?.();
			} catch (e) {
				error = e instanceof Error ? e.message : 'Fehler beim Löschen';
			}
			return;
		}

		if (!(await enterDraft())) return;

		if (ruleset.id != null && ruleset.id < 0) {
			const key = tempKeys.get(ruleset.id);
			if (key) suggestionDraft.unstage(key);
			return;
		}

		busy = true;
		try {
			const live = liveRulesets.find((r) => r.id === ruleset.id) ?? ruleset;
			suggestionDraft.stageDelete(live, await deleteSnapshot(live));
		} finally {
			busy = false;
		}
	}

	async function deleteSnapshot(ruleset: Ruleset) {
		try {
			const items = collectItems(ruleset.topic, await fetchItemsForTopics([ruleset.topic]));
			if (items.length === 0) return null;
			const after = effective.filter((r) => r.id !== ruleset.id);
			return getChangeSnapshot(
				{ op: 'delete', base: { ruleset: toBaseRuleset(ruleset) } },
				items,
				liveRulesets,
				after,
				tvdbEpisodes
			);
		} catch {
			return null;
		}
	}

	function discardChange(change: SuggestionChange) {
		if (change.op === 'delete' && change.rulesetId != null) {
			suggestionDraft.restore(change.rulesetId, liveRulesets);
		} else {
			suggestionDraft.unstage(change.key);
		}
	}

	// ─── Ordering ────────────────────────────────────────────────

	function refFor(id: number | undefined): string | null {
		if (id == null) return null;
		return id < 0 ? (tempKeys.get(id) ?? null) : String(id);
	}

	function effectiveRefs(): string[] {
		return effective.map((r) => refFor(r.id)).filter((r): r is string => r !== null);
	}

	/** The wizard's simulator order as bundle refs, or undefined when it kept the current order. */
	function wizardOrder(ids: number[], newKey: string | null): string[] | undefined {
		const current = effectiveRefs();
		if (newKey && !current.includes(newKey)) current.push(newKey);
		const known = new Set(current);
		const refs = ids
			.map((id) => (id === NEW_RULESET_SENTINEL_ID ? newKey : refFor(id)))
			.filter((r): r is string => r !== null && known.has(r));
		const unchanged = refs.length === current.length && refs.every((r, i) => r === current[i]);
		return unchanged ? undefined : refs;
	}

	/** The wizard's simulator order as live ids, or undefined when it kept the live order. */
	function directOrder(ids: number[], savedId: number): number[] | undefined {
		const current = sortedLive.map((r) => r.id).filter((id): id is number => id != null);
		if (!current.includes(savedId)) current.push(savedId);
		const known = new Set(current);
		const order = ids
			.map((id) => (id === NEW_RULESET_SENTINEL_ID ? savedId : id))
			.filter((id) => known.has(id));
		const unchanged = order.length === current.length && order.every((id, i) => id === current[i]);
		return unchanged ? undefined : order;
	}

	async function move(index: number, delta: -1 | 1) {
		const target = index + delta;
		if (target < 0 || target >= effective.length) return;

		if (!usesDraft) {
			const list = [...effective];
			[list[index], list[target]] = [list[target], list[index]];
			try {
				await reorderRulesets(
					list.map((r, i) => ({ id: r.id!, priority: i })).filter((c) => c.id != null)
				);
				await onReload?.();
			} catch (e) {
				error = e instanceof Error ? e.message : 'Fehler beim Sortieren';
			}
			return;
		}

		if (!(await enterDraft())) return;
		const refs = effectiveRefs();
		[refs[index], refs[target]] = [refs[target], refs[index]];
		suggestionDraft.setOrder(refs);
	}

	// ─── Wizard save ─────────────────────────────────────────────

	async function handleSave(
		data: Omit<Ruleset, 'id'>,
		snapshot: ChangeSnapshot | null,
		simulatorOrder: number[]
	) {
		error = null;

		if (!usesDraft) {
			let saved: Ruleset;
			try {
				saved = editingRuleset?.id
					? await updateRuleset(editingRuleset.id, data)
					: await createRuleset({ ...data, mediaId: media.id });
			} catch (e) {
				error = e instanceof Error ? e.message : 'Fehler beim Speichern';
				throw e;
			}
			const order = saved.id != null ? directOrder(simulatorOrder, saved.id) : undefined;
			if (order) {
				try {
					await reorderRulesets(order.map((id, priority) => ({ id, priority })));
				} catch (e) {
					error = `Ruleset gespeichert, Reihenfolge nicht: ${e instanceof Error ? e.message : 'Fehler beim Sortieren'}`;
				}
			}
			closeWizard();
			await onReload?.();
			return;
		}

		if (editingBase) {
			suggestionDraft.stageUpdate(data, editingBase, snapshot, wizardOrder(simulatorOrder, null));
		} else {
			const key = editingChangeKey ?? nextTempKey(draft.changes);
			suggestionDraft.stageCreate(data, snapshot, key, wizardOrder(simulatorOrder, key));
		}
		closeWizard();
	}

	function closeWizard() {
		showWizard = false;
		editingRuleset = null;
		editingBase = null;
		editingChangeKey = null;
		rebaseFrom = null;
		showRebaseDiff = false;
	}

	function cancelWizard() {
		if (proposedMedia && draft.changes.length === 0) {
			if (!confirm('Vorschlag verwerfen und zurück zur Übersicht?')) return;
			suggestionDraft.clear();
			goto('/media');
			return;
		}
		if (viewDetail) {
			goto(`/suggestions/${viewDetail.id}`);
			return;
		}
		closeWizard();
	}

	// ─── Bundle coverage ─────────────────────────────────────────

	let bundleSignature = $derived(
		draftActive
			? JSON.stringify([
					draft.key,
					draft.changes.map((c) => [c.key, c.op, c.ruleset, c.rulesetId]),
					draft.order
				])
			: ''
	);

	$effect(() => {
		const signature = bundleSignature;
		untrack(() => recomputeCoverage(signature));
	});

	async function recomputeCoverage(signature: string) {
		if (!signature || draft.changes.length === 0) {
			if (draft.coverage) suggestionDraft.setCoverage(null);
			return;
		}
		coverageLoading = true;
		try {
			const topics = draft.changes.map(
				(c) => c.ruleset?.topic ?? c.base?.ruleset.topic ?? ''
			);
			const itemsByTopic = await fetchItemsForTopics(topics);
			if (signature !== bundleSignature) return;
			suggestionDraft.setCoverage(
				computeBundleCoverage(draft.changes, itemsByTopic, liveRulesets, effective, tvdbEpisodes)
			);
		} catch {
			if (signature === bundleSignature) suggestionDraft.setCoverage(null);
		} finally {
			coverageLoading = false;
		}
	}

	// ─── Submit ──────────────────────────────────────────────────

	function openSubmit() {
		if (suggestionId) {
			saveRevision();
			return;
		}
		submitError = null;
		submitDescription = draft.description;
		submitOpen = true;
	}

	/** Non-stale changes are re-based on the current live ruleset before a PUT. */
	function rebaseNonStale() {
		for (const change of draft.changes) {
			if (change.op === 'create' || staleKeys.has(change.key)) continue;
			const live = liveRulesets.find((r) => r.id === change.rulesetId);
			if (live) suggestionDraft.rebaseChange(change.key, live, change.snapshot);
		}
	}

	async function saveRevision() {
		const baseRevision = draft.baseRevision;
		if (!suggestionId || baseRevision === null) return;
		isSubmitting = true;
		error = null;
		try {
			rebaseNonStale();
			const detail = await reviseSuggestion(suggestionId, {
				revision: baseRevision,
				description: draft.description,
				bundle: suggestionDraft.toBundle()
			});
			suggestionDraft.clear();
			await goto(`/suggestions/${detail.id}`);
		} catch (e) {
			if (isRevisionChangedError(e)) {
				isSubmitting = false;
				await openProposalDraft(suggestionId, null, true);
				return;
			}
			handleSubmitError(e);
		} finally {
			isSubmitting = false;
		}
	}

	async function submitNew(description: string) {
		isSubmitting = true;
		submitError = null;
		try {
			suggestionDraft.setDescription(description);
			const bundle = suggestionDraft.toBundle();
			const forkedFromId = draft.forkedFromId ?? undefined;
			const detail = await createSuggestion(
				proposedMedia
					? { proposedMedia, description, bundle, forkedFromId }
					: { mediaId: media.id, description, bundle, forkedFromId }
			);
			suggestionDraft.clear();
			submitOpen = false;
			await goto(`/suggestions/${detail.id}`);
		} catch (e) {
			handleSubmitError(e);
		} finally {
			isSubmitting = false;
		}
	}

	function handleSubmitError(e: unknown) {
		const stale = getStaleFromError(e);
		const message = e instanceof Error ? e.message : 'Vorschlag konnte nicht gespeichert werden';
		if (stale) {
			suggestionDraft.markStale(stale);
			submitOpen = false;
		}
		submitError = message;
		error = message;
	}

	function discardDraft() {
		if (suggestionId) {
			if (unsavedEdits && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
		} else if (!confirm('Alle gesammelten Änderungen verwerfen?')) {
			return;
		}
		suggestionDraft.clear();
		proposalMode = false;
		if (proposedMedia) goto('/media');
	}

	// ─── Display helpers ─────────────────────────────────────────

	let mine = $derived<SuggestionSummary | null>(mediaSuggestions?.mine ?? null);
	let openCount = $derived(otherOpen.length);
	let typeLabel = $derived(media.type === 'show' ? 'Serie' : 'Film');
	let forThisMedia = $derived(media.type === 'show' ? 'diese Serie' : 'diesen Film');
	let thisMediaCapital = $derived(media.type === 'show' ? 'Diese Serie' : 'Dieser Film');
	let wizardMode = $derived<'direct' | 'draft' | 'view'>(
		viewDetail ? 'view' : usesDraft ? 'draft' : 'direct'
	);
	let statusLabel = $derived(
		viewDetail?.status === 'accepted'
			? 'angenommen'
			: viewDetail?.status === 'rejected'
				? 'abgelehnt'
				: viewDetail?.status === 'withdrawn'
					? 'zurückgezogen'
					: 'nicht bearbeitbar'
	);
</script>

<div class="space-y-6">
	<div>
		<a href="/media" class="btn btn-ghost btn-sm mb-3">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
			</svg>
			Zurück zu Serien
		</a>

		<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
			<div>
				<h1 class="text-2xl font-bold">{media.name}</h1>
				<div class="flex flex-wrap gap-1.5 mt-2">
					<Badge variant={media.type === 'show' ? 'accent' : 'info'}>{typeLabel}</Badge>
					{#if media.tvdbId}
						<Badge>TVDB: {media.tvdbId}</Badge>
					{/if}
					{#if durationInfo}
						<Badge size="sm">Ø {durationInfo.averageRuntime} min</Badge>
					{/if}
					{#if proposedMedia}
						<Badge variant="accent">Vorgeschlagen</Badge>
					{:else if draftActive}
						<Badge variant="accent">Entwurf</Badge>
					{/if}
				</div>
				{#if usesDraft && !viewDetail}
					<p class="text-sm text-text-tertiary mt-2">
						Deine Änderungen werden als Vorschlag gesammelt.
					</p>
				{/if}
			</div>

			{#if !showWizard}
				{#if role === 'guest'}
					<a href="/login" class="btn btn-ghost">Anmelden, um Änderungen vorzuschlagen</a>
				{:else}
					<Button variant="primary" onclick={async () => { if (usesDraft && !(await enterDraft())) return; startAddNew(); }}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
						</svg>
						Neues Ruleset
					</Button>
				{/if}
			{/if}
		</div>
	</div>

	{#if error}
		<Alert variant="error">{error}</Alert>
	{/if}

	{#if existsNote}
		<Alert variant="info">
			<span>{media.name} existiert bereits, du kannst hier Änderungen vorschlagen.</span>
		</Alert>
	{/if}

	{#if proposedMedia}
		<Alert variant="info">
			<span>
				{thisMediaCapital} existiert noch nicht und wird zusammen mit dem Vorschlag angelegt.
				<span class="font-mono tabular-nums text-xs">
					{proposedMedia.tvdbId ? `TVDB ${proposedMedia.tvdbId}` : ''}
					{proposedMedia.tmdbId ? ` · TMDB ${proposedMedia.tmdbId}` : ''}
					{proposedMedia.imdbId ? ` · IMDB ${proposedMedia.imdbId}` : ''}
				</span>
			</span>
		</Alert>
	{/if}

	{#if openCount > 0}
		<Alert variant="info">
			<span>
				{openCount}
				{openCount === 1 ? 'offener Vorschlag' : 'offene Vorschläge'} für {media.name} ·
				<a href="/suggestions?mediaId={media.id}" class="text-accent hover:underline">ansehen</a>
			</span>
		</Alert>
	{/if}

	{#if mine && !draftActive}
		<Alert variant="info">
			<span class="flex flex-wrap items-center gap-2">
				<span>Du hast einen offenen Vorschlag #{mine.id}</span>
				<ChangeChips counts={mine.changeCounts} />
				<button
					type="button"
					class="text-accent hover:underline"
					onclick={() => openProposalDraft(mine!.id, null)}
				>
					Weiter bearbeiten
				</button>
				<a href="/suggestions/{mine.id}" class="text-accent hover:underline">Ansehen</a>
			</span>
		</Alert>
	{/if}

	{#if showWizard}
		<div>
			<div class="flex flex-wrap justify-between items-center gap-2 mb-4">
				<h2 class="text-xl font-semibold flex items-center gap-2">
					{editingRuleset ? 'Ruleset bearbeiten' : 'Neues Ruleset erstellen'}
					{#if viewDetail}
						<Badge>Nur Ansicht</Badge>
					{:else if suggestionId}
						<Badge variant="accent">Vorschlag #{suggestionId}</Badge>
					{:else if draftActive}
						<Badge variant="accent">Entwurf</Badge>
					{/if}
				</h2>
			</div>

			{#if rebaseFrom && editingBase}
				<div class="mb-4">
					<Alert variant="warning">
						<div class="space-y-2">
							<p>Das Live-Ruleset wurde seit deinem Entwurf geändert.</p>
							<button
								type="button"
								class="text-xs text-text-secondary hover:text-text transition-colors"
								onclick={() => (showRebaseDiff = !showRebaseDiff)}
							>
								{showRebaseDiff ? 'Unterschiede ausblenden' : 'Unterschiede anzeigen'}
							</button>
							{#if showRebaseDiff}
								<RulesetDiff op="update" base={rebaseFrom} ruleset={editingBase} />
							{/if}
						</div>
					</Alert>
				</div>
			{/if}

			<WizardBuilder
				{media}
				existingRuleset={editingRuleset ?? undefined}
				{durationInfo}
				{tvdbShowData}
				mode={wizardMode}
				rulesets={effective}
				{liveRulesets}
				baseRuleset={editingBase}
				viewNote={viewDetail
					? `Nur Ansicht — Vorschlag #${viewDetail.id} ist ${statusLabel}.`
					: undefined}
				onSave={handleSave}
				onCancel={cancelWizard}
				canCancel={effective.length > 0 || draft.changes.length > 0 || proposedMedia !== null}
			/>
		</div>
	{:else}
		<div>
			<div class="mb-4">
			<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h2 class="text-xl font-semibold">
					Rulesets ({liveRulesets.length !== effective.length
						? `${liveRulesets.length} → ${effective.length}`
						: effective.length})
				</h2>
				<div class="flex flex-wrap items-baseline gap-x-4 text-sm">
					{#if rowCoverage}
						<span class="text-text-secondary">
							<span class="font-mono font-medium tabular-nums text-text">{rowCoverage.total}</span>
							{#if tvdbEpisodeCount > 0}
								von <span class="font-mono tabular-nums">{tvdbEpisodeCount}</span> TVDB-Folgen erkannt
							{:else}
								{rowCoverage.total === 1 ? 'Folge' : 'Folgen'} erkannt
							{/if}
						</span>
					{/if}
					{#if draftActive && !orderIsDefault}
						<button
							type="button"
							class="text-text-secondary hover:text-text transition-colors"
							onclick={() => suggestionDraft.resetOrder()}
						>
							Reihenfolge zurücksetzen
						</button>
					{/if}
				</div>
			</div>
			{#if facetSplit.shared.length > 0}
				<p class="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
					<span class="text-text-tertiary">Für alle:</span>
					{#each facetSplit.shared as facet (facet)}
						<span class="inline-flex min-w-0 items-baseline gap-1.5">
							<span class="text-text-tertiary">{FACET_LABELS[facet]}</span>
							<span class="font-medium text-text"><RulesetFacet ruleset={tiles[0].ruleset} {facet} /></span>
						</span>
					{/each}
				</p>
			{/if}
			</div>

			{#if tiles.length === 0}
				<div class="text-center py-8 bg-surface rounded-lg border border-border">
					<p class="text-text-secondary mb-2">Keine Rulesets vorhanden</p>
					{#if role === 'guest'}
						<p class="text-sm text-text-tertiary">
							<a href="/login" class="text-accent hover:underline">Anmelden</a>, um das erste
							Ruleset vorzuschlagen
						</p>
					{/if}
				</div>
			{:else}
				<div class="card">
					<div
						class="flex flex-col divide-y divide-border md:grid md:gap-x-5"
						style:grid-template-columns={gridColumns(facetSplit.varying)}
					>
						{#if facetSplit.varying.length > 1}
							<div class="hidden px-4 py-2 text-xs font-medium text-text-tertiary md:col-span-full md:grid md:grid-cols-subgrid">
								<span class="w-6 text-right">#</span>
								{#each facetSplit.varying as facet (facet)}
									<span>{FACET_LABELS[facet]}</span>
								{/each}
								<span>Folgen</span>
								<span></span>
								<span></span>
							</div>
						{/if}
						{#each tiles as tile (tile.ruleset.id ?? tile.position)}
							{@const stale = tile.change ? staleKeys.has(tile.change.key) : false}
							<RulesetRow
								ruleset={tile.ruleset}
								facets={facetSplit.varying}
								canEdit={role !== 'guest'}
								position={tile.position}
								coverage={tile.deleted ? null : coverageFor(tile.ruleset)}
								coverageMax={rowCoverage?.max ?? 0}
								coverageLoading={rowCoverageLoading && !tile.deleted}
								op={tile.change?.op ?? null}
								{stale}
								matches={tile.change?.snapshot
									? {
											before: tile.change.snapshot.before.matchedByThis,
											after: tile.change.snapshot.after.matchedByThis
										}
									: null}
								proposals={proposalBadge(tile.ruleset)}
								canMoveUp={!tile.deleted && tile.position > 1}
								canMoveDown={!tile.deleted && tile.position < effective.length}
								onMoveUp={role === 'guest' ? undefined : () => move(tile.position - 1, -1)}
								onMoveDown={role === 'guest' ? undefined : () => move(tile.position - 1, 1)}
								onEdit={() => startEdit(tile)}
								onDelete={() => handleDelete(tile.ruleset)}
								onDuplicate={() => handleDuplicate(tile.ruleset)}
								onDiscard={tile.change ? () => discardChange(tile.change!) : undefined}
								discardLabel={tile.deleted ? 'Wiederherstellen' : 'Änderung verwerfen'}
								onRebase={stale && tile.change ? () => openChange(tile.change!.key, true) : undefined}
							/>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if draftActive && !showWizard && !viewDetail}
	<DraftBar
		{counts}
		coverage={draft.coverage}
		{coverageLoading}
		mode={suggestionId ? 'save' : 'submit'}
		{suggestionId}
		{revision}
		hasUnsavedEdits={unsavedEdits}
		disabledReason={submitBlocked}
		isSubmitting={isSubmitting || busy}
		onDiscard={discardDraft}
		onSubmit={openSubmit}
	/>
{/if}

<SubmitDialog
	bind:open={submitOpen}
	mediaName={media.name}
	{counts}
	coverage={draft.coverage}
	bind:description={submitDescription}
	{isSubmitting}
	error={submitError}
	onSubmit={submitNew}
/>
