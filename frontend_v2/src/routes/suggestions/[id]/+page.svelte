<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto, replaceState } from '$app/navigation';
	import {
		acceptSuggestion,
		isRevisionChangedError,
		getStaleFromError,
		getSuggestion,
		getSuggestionRevision,
		getComments,
		getSuggestionsForMedia,
		rejectSuggestion,
		withdrawSuggestion
	} from '$api/suggestions';
	import { getRulesetsForMedia } from '$api/rulesets';
	import type { Ruleset } from '$types/ruleset';
	import type {
		ChangeCounts,
		StaleEntry,
		SuggestionChange,
		SuggestionComment,
		SuggestionDetail,
		SuggestionSummary
	} from '$types/suggestion';
	import { authStore, isAdmin } from '$stores/auth';
	import {
		mediaDraftKey,
		newMediaDraftKey,
		suggestionDraft
	} from '$stores/suggestionDraft';
	import { formatDate, formatDay, formatRelative } from '$utils/time';
	import {
		mediaTypeLabel,
		newMediaLabel,
		staleLabel,
		statusLabel,
		statusVariant
	} from '$utils/suggestion';
	import AcceptDialog from '$components/suggestions/AcceptDialog.svelte';
	import ChangeCard from '$components/suggestions/ChangeCard.svelte';
	import CommentSection from '$components/suggestions/CommentSection.svelte';
	import Delta from '$components/suggestions/Delta.svelte';
	import RevisionHistory from '$components/suggestions/RevisionHistory.svelte';
	import VoteButton from '$components/suggestions/VoteButton.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	let id = $derived(Number($page.params.id));

	let comments = $state<SuggestionComment[]>([]);

	async function reloadComments() {
		if (!suggestion) return;
		try {
			comments = await getComments(suggestion.id);
		} catch {
			// keeps the last known list
		}
	}

	type Tab = 'conversation' | 'changes';

	function tabFromUrl(): Tab {
		return $page.url.searchParams.get('tab') === 'aenderungen' ? 'changes' : 'conversation';
	}

	let tab = $state<Tab>(tabFromUrl());

	function selectTab(next: Tab) {
		tab = next;
		const url = new URL($page.url);
		if (next === 'changes') url.searchParams.set('tab', 'aenderungen');
		else url.searchParams.delete('tab');
		replaceState(url, $page.state);
	}

	function countParts(counts: ChangeCounts): string[] {
		const parts: string[] = [];
		if (counts.create > 0) parts.push(`${counts.create} ${counts.create === 1 ? 'neues Ruleset' : 'neue Rulesets'}`);
		if (counts.update > 0) parts.push(`${counts.update} ${counts.update === 1 ? 'Änderung' : 'Änderungen'}`);
		if (counts.delete > 0) parts.push(`${counts.delete} ${counts.delete === 1 ? 'Löschung' : 'Löschungen'}`);
		return parts;
	}

	function joinParts(parts: string[]): string {
		if (parts.length <= 1) return parts[0] ?? 'keine Änderungen';
		return `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}`;
	}

	let showReject = $state(false);
	let note = $derived($page.url.searchParams.get('note'));

	let suggestion = $state<SuggestionDetail | null>(null);
	let liveRulesets = $state<Ruleset[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let votes = $state(0);
	let hasVoted = $state(false);

	let mediaId = $derived(suggestion?.media?.id ?? null);
	let mediaType = $derived(suggestion?.media?.type ?? suggestion?.proposedMedia?.type ?? null);
	let mediaName = $derived(
		suggestion?.media?.name ?? suggestion?.proposedMedia?.name ?? 'Unbekannt'
	);
	let tvdbId = $derived(suggestion?.media?.tvdbId ?? suggestion?.proposedMedia?.tvdbId ?? null);

	let isAuthor = $derived(
		suggestion !== null && $authStore.user?.id === suggestion.author.id
	);
	let canEdit = $derived(suggestion?.status === 'open' && (isAuthor || $isAdmin));

	let isMovie = $derived(mediaType === 'movie');
	let thisMedia = $derived(isMovie ? 'dieser Film' : 'diese Serie');
	let forThisMedia = $derived(isMovie ? 'diesen Film' : 'diese Serie');

	let lastRevisionAt = $derived(
		suggestion && suggestion.revisions.length > 0
			? suggestion.revisions.reduce((a, b) => (b.number > a.number ? b : a)).createdAt
			: null
	);

	let staleKeys = $derived(new Set((suggestion?.stale ?? []).map((s) => s.key)));

	let isOpen = $derived(suggestion?.status === 'open');
	let staleEntries = $derived(suggestion?.stale ?? []);
	let editHref = $derived(
		suggestion && mediaId ? `/media/${mediaId}/rulesets?draft=suggestion:${suggestion.id}` : null
	);

	let actionError = $state<string | null>(null);
	let reviewError = $state<string | null>(null);
	let isWithdrawing = $state(false);
	let isForking = $state(false);
	let ownOpen = $state<SuggestionSummary | null>(null);

	let reviewComment = $state('');
	let acceptOpen = $state(false);
	let acceptComment = $state('');
	let isAccepting = $state(false);
	let isRejecting = $state(false);
	let acceptError = $state<string | null>(null);
	let acceptStale = $state<StaleEntry[] | null>(null);

	let loadToken = 0;

	/** `background` keeps the page rendered (after an action); only the first load shows the spinner. */
	async function load(suggestionId: number, background = false) {
		const token = ++loadToken;
		if (!background) isLoading = true;
		error = null;
		try {
			const [result, loadedComments] = await Promise.all([
				getSuggestion(suggestionId),
				getComments(suggestionId)
			]);
			if (token !== loadToken) return;
			comments = loadedComments;
			liveRulesets = [];
			suggestion = result;
			votes = result.votes;
			hasVoted = result.hasVoted;

			if (result.media && result.bundle.order) {
				try {
					const live = await getRulesetsForMedia(result.media.id);
					if (token === loadToken) liveRulesets = live;
				} catch {
					// the order card degrades to the proposal's own refs
				}
			}
		} catch (e) {
			if (token !== loadToken) return;
			suggestion = null;
			error = e instanceof Error ? e.message : 'Vorschlag konnte nicht geladen werden';
		} finally {
			if (token === loadToken) isLoading = false;
		}
	}

	$effect(() => {
		const current = id;
		untrack(() => {
			suggestion = null;
			showReject = false;
			reviewComment = '';
			reviewError = null;
			acceptStale = null;
			actionError = null;
			tab = tabFromUrl();
		});
		if (Number.isFinite(current)) load(current);
		else {
			error = 'Ungültige Vorschlags-ID';
			isLoading = false;
		}
	});

	/** A fork needs a free slot: one open proposal per user and media. */
	$effect(() => {
		const target = mediaId;
		// re-check after withdraw/accept/reject frees the slot
		suggestion?.status;
		if (!target || !$authStore.isAuthenticated) {
			ownOpen = null;
			return;
		}
		let cancelled = false;
		getSuggestionsForMedia(target)
			.then((result) => {
				if (!cancelled) ownOpen = result.mine;
			})
			.catch(() => {
				if (!cancelled) ownOpen = null;
			});
		return () => {
			cancelled = true;
		};
	});

	async function fork() {
		if (!suggestion) return;
		isForking = true;
		actionError = null;
		try {
			const revision = await getSuggestionRevision(suggestion.id, suggestion.currentRevision);
			if (suggestion.media) {
				const key = mediaDraftKey(suggestion.media.id);
				if (
					suggestionDraft.exists(key) &&
					!confirm(`Für ${forThisMedia} gibt es lokale Änderungen. Durch die Kopie ersetzen?`)
				) {
					return;
				}
				suggestionDraft.forkFromRevision(key, revision, {
					mediaId: suggestion.media.id,
					forkedFromId: suggestion.id
				});
				await goto(`/media/${suggestion.media.id}/rulesets?draft=1`);
			} else if (suggestion.proposedMedia) {
				const proposed = suggestion.proposedMedia;
				const key = newMediaDraftKey(proposed);
				if (
					suggestionDraft.exists(key) &&
					!confirm('Für dieses Medium gibt es lokale Änderungen. Durch die Kopie ersetzen?')
				) {
					return;
				}
				suggestionDraft.forkFromRevision(key, revision, {
					proposedMedia: proposed,
					forkedFromId: suggestion.id
				});
				await goto(`/media/new/${encodeURIComponent(key)}/rulesets`);
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Kopieren fehlgeschlagen';
		} finally {
			isForking = false;
		}
	}

	async function withdraw() {
		if (!suggestion || !confirm('Diesen Vorschlag wirklich zurückziehen?')) return;
		isWithdrawing = true;
		actionError = null;
		try {
			await withdrawSuggestion(suggestion.id);
			await load(suggestion.id, true);
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Zurückziehen fehlgeschlagen';
		} finally {
			isWithdrawing = false;
		}
	}

	async function reject() {
		if (!suggestion || !reviewComment.trim()) return;
		isRejecting = true;
		reviewError = null;
		try {
			const target = suggestion.id;
			await rejectSuggestion(target, reviewComment.trim());
			reviewComment = '';
			showReject = false;
			await load(target, true);
		} catch (e) {
			reviewError = e instanceof Error ? e.message : 'Ablehnen fehlgeschlagen';
		} finally {
			isRejecting = false;
		}
	}

	function openAccept() {
		acceptComment = reviewComment;
		acceptError = null;
		acceptStale = null;
		reviewError = null;
		acceptOpen = true;
	}

	async function accept(comment: string) {
		if (!suggestion) return;
		const target = suggestion.id;
		isAccepting = true;
		acceptError = null;
		try {
			await acceptSuggestion(target, suggestion.currentRevision, comment || undefined);
			acceptOpen = false;
			reviewComment = '';
			await load(target, true);
		} catch (e) {
			const stale = getStaleFromError(e);
			if (isRevisionChangedError(e)) {
				acceptOpen = false;
				await load(target, true);
				reviewError = e instanceof Error ? e.message : null;
			} else if (stale) {
				acceptStale = stale;
				acceptOpen = false;
				await load(target, true);
			} else {
				acceptError = e instanceof Error ? e.message : 'Annehmen fehlgeschlagen';
			}
		} finally {
			isAccepting = false;
		}
	}

	interface OrderRow {
		position: number;
		topic: string;
		note: string | null;
		muted: boolean;
	}

	function buildOrder(detail: SuggestionDetail, live: Ruleset[]): OrderRow[] {
		const order = detail.bundle.order ?? [];
		const changes = detail.bundle.changes;
		const sortedLive = [...live].sort((a, b) => a.priority - b.priority);
		const livePosition = new Map(sortedLive.map((r, index) => [String(r.id), index]));
		const byKey = new Map(changes.map((c) => [c.key, c]));
		const byRulesetId = new Map<string, SuggestionChange>(
			changes.filter((c) => c.rulesetId != null).map((c) => [String(c.rulesetId), c])
		);
		const removed = new Set(
			changes.filter((c) => c.op === 'delete' && c.rulesetId != null).map((c) => String(c.rulesetId))
		);
		const rank = (refs: string[]) =>
			new Map(refs.filter((r) => livePosition.has(r) && !removed.has(r)).map((r, i) => [r, i]));
		const rankBefore = rank(sortedLive.map((r) => String(r.id)));
		const rankAfter = rank(order);

		const rows: OrderRow[] = order.map((ref, index) => {
			const created = byKey.get(ref);
			if (created?.op === 'create') {
				return {
					position: index + 1,
					topic: created.ruleset?.topic ?? ref,
					note: '(neu)',
					muted: false
				};
			}
			const change = byRulesetId.get(ref);
			const liveRuleset = sortedLive.find((r) => String(r.id) === ref);
			const previous = livePosition.get(ref);
			return {
				position: index + 1,
				topic:
					change?.ruleset?.topic ?? change?.base?.ruleset.topic ?? liveRuleset?.topic ?? `#${ref}`,
				note:
					previous !== undefined && rankBefore.get(ref) !== rankAfter.get(ref)
						? `(war ${previous + 1})`
						: null,
				muted: false
			};
		});

		const referenced = new Set(order);
		for (const ruleset of sortedLive) {
			const ref = String(ruleset.id);
			if (referenced.has(ref) || removed.has(ref)) continue;
			rows.push({
				position: rows.length + 1,
				topic: ruleset.topic,
				note: 'nicht im Vorschlag',
				muted: true
			});
		}

		return rows;
	}

	let orderRows = $derived(
		suggestion && suggestion.bundle.order ? buildOrder(suggestion, liveRulesets) : []
	);


	let createdRulesetIds = $derived(Object.values(suggestion?.appliedResult?.created ?? {}));

	let coverageDelta = $derived(
		suggestion?.coverage
			? suggestion.coverage.after.coveredByAny - suggestion.coverage.before.coveredByAny
			: 0
	);

	let statusColour = $derived.by(() => {
		if (!suggestion) return '';
		const variant = statusVariant(suggestion.status);
		return `var(--color-${variant === 'default' ? 'text-tertiary' : variant})`;
	});

	let changeSummary = $derived(
		suggestion
			? [
					{ count: suggestion.changeCounts.create, label: 'neu', tone: 'text-success' },
					{ count: suggestion.changeCounts.update, label: 'geändert', tone: 'text-info' },
					{ count: suggestion.changeCounts.delete, label: 'gelöscht', tone: 'text-error' }
				].filter((part) => part.count > 0)
			: []
	);
</script>

<svelte:head>
	<title>Vorschlag #{id} - MediathekArr</title>
</svelte:head>

{#snippet mergeBox()}
	{#if suggestion}
		<div class="flex gap-3 text-sm">
			<span
				class="status-fill flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
				style="--status: {statusColour}"
				aria-hidden="true"
			>
				<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="4.5" cy="3.5" r="1.5" /><circle cx="11.5" cy="12.5" r="1.5" /><path d="M4.5 5v8M11.5 11V7.5c0-1.5-1-2.5-2.5-2.5H7" />
				</svg>
			</span>

			<div class="min-w-0 flex-1 rounded-lg border border-border-strong bg-bg overflow-hidden">
				{#if suggestion.resolvedBy}
					<div class="px-3.5 py-3 space-y-1.5">
						<p class="font-semibold">
							{statusLabel(suggestion.status)} von @{suggestion.resolvedBy} am {formatDay(suggestion.resolvedAt)}
						</p>
						{#if suggestion.resolutionComment}
							<p class="whitespace-pre-wrap text-text-secondary">{suggestion.resolutionComment}</p>
						{/if}
						{#if suggestion.status === 'accepted' && suggestion.appliedResult}
							{@const applied = suggestion.appliedResult}
							<p class="text-sm text-text-secondary">
								<a href="/media/{applied.mediaId}/rulesets" target="_blank" rel="noopener" class="text-accent hover:underline">
									Rulesets ansehen ↗
								</a>
								{#if createdRulesetIds.length > 0}
									· erstellt:
									<span class="font-mono tabular-nums">{createdRulesetIds.map((rid) => `#${rid}`).join(', ')}</span>
								{/if}
								{#if applied.updated.length > 0}
									· geändert:
									<span class="font-mono tabular-nums">{applied.updated.map((rid) => `#${rid}`).join(', ')}</span>
								{/if}
							</p>
						{/if}
					</div>
				{:else}
					<div class="flex gap-3 px-3.5 py-3 border-b border-border">
						{#if !suggestion.coverage}
							<span class="check-icon text-text-tertiary">–</span>
							<p class="text-text-secondary">Keine Messdaten zur Abdeckung</p>
						{:else}
							<span class="check-icon" class:text-success={coverageDelta > 0} class:text-warning={coverageDelta < 0} class:text-text-tertiary={coverageDelta === 0}>
								{coverageDelta > 0 ? '✓' : coverageDelta < 0 ? '!' : '–'}
							</span>
							<div>
								<p class="font-semibold">
									{#if coverageDelta === 0}
										Keine Änderung bei der Zuordnung
									{:else}
										{Math.abs(coverageDelta)}
										{Math.abs(coverageDelta) === 1 ? 'Video' : 'Videos'}
										{#if suggestion.coverage.before.coveredByAny > 0}
											{coverageDelta > 0 ? 'mehr' : 'weniger'}
										{/if}
										{Math.abs(coverageDelta) === 1 ? 'wird' : 'werden'} einer Episode zugeordnet
									{/if}
								</p>
								<p class="text-sm text-text-secondary" title="Videos, denen ein Ruleset eine TVDB-Episode zuordnet">
									{suggestion.coverage.before.coveredByAny} → {suggestion.coverage.after.coveredByAny} zugeordnete Videos ·
									gemessen am {formatDay(suggestion.coverage.capturedAt)}
								</p>
							</div>
						{/if}
					</div>

					<div class="flex gap-3 px-3.5 py-3 border-b border-border">
						{#if staleEntries.length === 0}
							<span class="check-icon text-success">✓</span>
							<div>
								<p class="font-semibold">Auf dem aktuellen Stand</p>
								<p class="text-sm text-text-secondary">Keines der betroffenen Rulesets wurde seit dem Einreichen geändert.</p>
							</div>
						{:else}
							<span class="check-icon text-warning">!</span>
							<div>
								<p class="font-semibold">
									{staleEntries.length}
									{staleEntries.length === 1 ? 'Änderung ist veraltet' : 'Änderungen sind veraltet'}
								</p>
								<ul class="text-sm text-text-secondary">
									{#each staleEntries as entry, index (index)}
										<li>{staleLabel(entry)}</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>

					<div class="px-3.5 py-3 bg-surface space-y-3">
						{#if $isAdmin && isOpen}
							{#if showReject}
								<label class="block space-y-1.5">
									<span class="text-sm font-medium">Begründung für die Ablehnung</span>
									<textarea class="input min-h-[80px] resize-y" bind:value={reviewComment}></textarea>
								</label>
								<div class="flex justify-end gap-2">
									<button type="button" class="btn btn-ghost" onclick={() => (showReject = false)}>Abbrechen</button>
									<Button variant="danger" disabled={reviewComment.trim().length === 0} loading={isRejecting} onclick={reject}>
										Ablehnen
									</Button>
								</div>
							{:else}
								<div class="flex flex-wrap items-center justify-between gap-3">
									<span class="text-sm text-text-secondary">
										{staleEntries.length > 0
											? 'Veraltete Änderungen müssen erst aktualisiert werden.'
											: 'Annehmen übernimmt die Änderungen live.'}
									</span>
									<div class="flex gap-2">
										<button type="button" class="btn text-error" onclick={() => (showReject = true)}>Ablehnen</button>
										<Button variant="primary" disabled={staleEntries.length > 0 || isAccepting} onclick={openAccept}>
											Annehmen
										</Button>
									</div>
								</div>
							{/if}
							{#if reviewError}
								<p class="text-xs text-error">{reviewError}</p>
							{/if}
							{#if acceptStale && acceptStale.length > 0}
								<Alert variant="warning">
									<div class="space-y-1">
										<p>Der Vorschlag ist nicht mehr aktuell:</p>
										<ul class="text-sm space-y-0.5">
											{#each acceptStale as entry, index (index)}
												<li>{staleLabel(entry)}</li>
											{/each}
										</ul>
									</div>
								</Alert>
							{/if}
						{:else if isOpen}
							<p class="text-sm text-text-secondary">Wartet auf Prüfung durch einen Admin.</p>
						{:else}
							<p class="text-sm text-text-secondary">{statusLabel(suggestion.status)}</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet sidebar()}
	{#if suggestion}
		<aside class="text-[0.8125rem] divide-y divide-border [&>section]:py-4 [&>section:first-child]:pt-0">
			<section class="space-y-1">
				<h2 class="text-xs font-semibold text-text-secondary">Stimmen</h2>
				<p>{votes} {votes === 1 ? 'Stimme' : 'Stimmen'}</p>
			</section>

			<section class="space-y-1">
				<h2 class="text-xs font-semibold text-text-secondary">{mediaType ? mediaTypeLabel(mediaType) : 'Serie'}</h2>
				<p class="flex flex-wrap items-center gap-2">
					{#if suggestion.media}
						<a href="/media/{suggestion.media.id}/rulesets" class="text-accent hover:underline">{suggestion.media.name}</a>
					{:else}
						{mediaName}
						{#if suggestion.proposedMedia}
							<Badge size="sm">{newMediaLabel(suggestion.proposedMedia.type)}</Badge>
						{/if}
					{/if}
				</p>
			</section>

			<section class="space-y-1">
				<h2 class="text-xs font-semibold text-text-secondary">Revisionen</h2>
				<p>
					{suggestion.currentRevision} · zuletzt
					<span title={formatDate(lastRevisionAt)}>{formatRelative(lastRevisionAt)}</span>
				</p>
				<p class="text-text-secondary">
					Erstellt am <span title={formatDate(suggestion.createdAt)}>{formatDay(suggestion.createdAt)}</span>
				</p>
				{#if suggestion.forkedFromId}
					<p class="text-text-secondary">
						Kopiert von
						<a href="/suggestions/{suggestion.forkedFromId}" class="text-accent hover:underline">#{suggestion.forkedFromId}</a>
					</p>
				{/if}
			</section>

			{#if $authStore.isAuthenticated}
				<section class="space-y-2">
					{#if canEdit && !editHref}
						<p class="text-xs text-text-secondary">
							Vorschläge für {isMovie ? 'neue Filme' : 'neue Serien'} lassen sich derzeit nur über eine Kopie ändern.
						</p>
					{/if}
					<button
						type="button"
						class="btn btn-sm"
						disabled={isForking || ownOpen !== null}
						onclick={fork}
					>
						{#if isForking}<span class="spinner spinner-sm"></span>{:else}
							<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
								<rect x="5" y="5" width="8.5" height="8.5" rx="1.5" /><path d="M11 5V3.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1V10a1 1 0 0 0 1 1H5" />
							</svg>
						{/if}
						Als neuen Vorschlag kopieren
					</button>
					{#if ownOpen && ownOpen.id === suggestion.id}
						<p class="text-xs text-text-secondary">Das ist dein offener Vorschlag für {forThisMedia}.</p>
					{:else if ownOpen}
						<p class="text-xs text-text-secondary">
							Du hast bereits einen offenen Vorschlag
							<a href="/suggestions/{ownOpen.id}" class="text-accent hover:underline">#{ownOpen.id}</a>
							für {forThisMedia}.
						</p>
					{/if}

					{#if isAuthor && isOpen}
						<button type="button" class="btn btn-sm btn-danger" disabled={isWithdrawing} onclick={withdraw}>
							{#if isWithdrawing}<span class="spinner spinner-sm"></span>{/if}
							Zurückziehen
						</button>
					{/if}

					{#if actionError}
						<p class="text-xs text-error">{actionError}</p>
					{/if}
				</section>
			{/if}
		</aside>
	{/if}
{/snippet}

<div class="mx-auto max-w-6xl space-y-5">
	<a href="/suggestions" class="text-sm text-text-secondary hover:text-text">← Vorschläge</a>

	{#if isLoading}
		<div class="flex justify-center py-12"><Spinner size="lg" /></div>
	{:else if error}
		<Alert variant="error">{error}</Alert>
	{:else if suggestion}
		<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="min-w-0 space-y-2.5">
				<h1 class="text-xl font-semibold tracking-tight">
					{mediaName}
					<span class="font-normal text-text-tertiary">#{suggestion.id}</span>
				</h1>
				<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-text-secondary">
					<span
						class="status-fill inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
						style="--status: {statusColour}"
					>
						{statusLabel(suggestion.status)}
					</span>
					{#if suggestion.proposedMedia}
						<Badge variant="accent" size="sm">{newMediaLabel(suggestion.proposedMedia.type)}</Badge>
					{/if}
					{#if suggestion.isStale}
						<Badge variant="warning">Veraltet</Badge>
					{/if}
					<span>
						<strong class="font-semibold text-text">@{suggestion.author.username}</strong>
						schlägt {joinParts(countParts(suggestion.changeCounts))} für
						{#if suggestion.media}
							<a href="/media/{suggestion.media.id}/rulesets" class="text-accent hover:underline">{mediaName}</a>
						{:else}
							{mediaName}
						{/if}
						vor · Revision {suggestion.currentRevision}
					</span>
				</div>
			</div>
			<div class="flex items-start gap-2 shrink-0">
				<VoteButton suggestionId={suggestion.id} bind:votes bind:hasVoted />
				{#if canEdit && editHref}
					<a href={editHref} class="btn h-9">Bearbeiten</a>
				{/if}
			</div>
		</header>

		{#if suggestion.proposedMedia}
			<Alert variant="info">
				{isMovie ? 'Dieser Film existiert' : 'Diese Serie existiert'} noch nicht und wird zusammen mit dem Vorschlag angelegt.
				{#if tvdbId}
					<a
						href="https://www.thetvdb.com/?tab=series&id={tvdbId}"
						target="_blank"
						rel="noopener noreferrer"
						class="text-accent hover:underline"
					>
						TVDB {tvdbId}
					</a>
				{/if}
			</Alert>
		{/if}

		{#if note === 'nur-autor'}
			<Alert variant="info">
				Nur der Autor oder ein Admin kann diesen Vorschlag bearbeiten. Du kannst ihn als neuen
				Vorschlag kopieren.
			</Alert>
		{/if}

		<div class="flex gap-6 border-b border-border" role="tablist" aria-label="Ansicht">
			<button
				type="button"
				id="tab-conversation"
				class="tab"
				class:tab-active={tab === 'conversation'}
				role="tab"
				aria-selected={tab === 'conversation'}
				aria-controls="panel-conversation"
				onclick={() => selectTab('conversation')}
			>
				<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
					<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
				</svg>
				Unterhaltung
			</button>
			<button
				type="button"
				id="tab-changes"
				class="tab"
				class:tab-active={tab === 'changes'}
				role="tab"
				aria-selected={tab === 'changes'}
				aria-controls="panel-changes"
				onclick={() => selectTab('changes')}
			>
				<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
					<path d="M4 2.5h5.5L12 5v8.5H4z" /><path d="M6.5 8h3M8 6.5v3" />
				</svg>
				Änderungen
				<span class="rounded-full bg-surface-raised px-2 text-xs leading-5">{suggestion.bundle.changes.length}</span>
			</button>
		</div>

		<div
			id="panel-conversation"
			role="tabpanel"
			aria-labelledby="tab-conversation"
			hidden={tab !== 'conversation'}
		>
			<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_14rem] items-start">
				<div class="min-w-0">
					<RevisionHistory
						suggestionId={suggestion.id}
						revisions={suggestion.revisions}
						author={suggestion.author.username}
						description={suggestion.description}
						createdAt={suggestion.createdAt}
						{comments}
						onCommentUpdated={(updated) =>
							(comments = comments.map((c) => (c.id === updated.id ? updated : c)))}
						onCommentRemoved={reloadComments}
					/>
					<div class="pt-5">{@render mergeBox()}</div>
					<div class="mt-5 border-t border-border pt-5">
						<CommentSection
							suggestionId={suggestion.id}
							onAdded={(created) => (comments = [...comments, created])}
						/>
					</div>
				</div>
				{@render sidebar()}
			</div>
		</div>

		<div id="panel-changes" role="tabpanel" aria-labelledby="tab-changes" hidden={tab !== 'changes'}>
			<div class="space-y-4">
				<div class="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
					<span>
						{suggestion.bundle.changes.length}
						{suggestion.bundle.changes.length === 1 ? 'Ruleset' : 'Rulesets'}
						{#each changeSummary as part (part.label)}
							· <span class="{part.tone} font-medium">{part.count} {part.label}</span>
						{/each}
					</span>
					{#if suggestion.coverage}
						<span title="Videos, denen ein Ruleset eine TVDB-Episode zuordnet">
							<Delta
								label="Zugeordnete Videos"
								before={suggestion.coverage.before.coveredByAny}
								after={suggestion.coverage.after.coveredByAny}
								size="sm"
							/>
						</span>
					{/if}
				</div>

				{#each suggestion.bundle.changes as change (change.key)}
					<ChangeCard
						{change}
						suggestionId={suggestion.id}
						{mediaId}
						{canEdit}
						stale={staleKeys.has(change.key)}
					>
						{#snippet staleAction()}
							{#if canEdit && editHref}
								<a href="{editHref}&change={encodeURIComponent(change.key)}" class="btn btn-sm">
									Basis aktualisieren
								</a>
							{/if}
						{/snippet}
					</ChangeCard>
				{/each}

				{#if orderRows.length > 0}
					<div class="rounded-lg border border-border-strong bg-bg overflow-hidden">
						<div class="px-3.5 py-2 bg-surface border-b border-border text-sm font-medium">Reihenfolge</div>
						<ol class="py-1 text-[0.8125rem]">
							{#each orderRows as row (row.position)}
								<li class="flex items-baseline gap-2 px-3.5 py-0.5" class:text-text-tertiary={row.muted}>
									<span class="w-6 shrink-0 font-mono tabular-nums text-text-tertiary">{row.position}</span>
									<span class="font-mono">{row.topic}</span>
									{#if row.note}
										<span class="text-xs text-text-tertiary">{row.note}</span>
									{/if}
								</li>
							{/each}
						</ol>
					</div>
				{/if}
			</div>
		</div>

		<AcceptDialog
			bind:open={acceptOpen}
			suggestionId={suggestion.id}
			counts={suggestion.changeCounts}
			coverage={suggestion.coverage}
			reorders={suggestion.bundle.order !== null}
			bind:comment={acceptComment}
			isSubmitting={isAccepting}
			error={acceptError}
			onAccept={accept}
		/>
	{/if}
</div>

<style>
	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: -1px;
		padding: 0.625rem 0.125rem;
		border-bottom: 2px solid transparent;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab-active {
		border-bottom-color: var(--color-accent);
		color: var(--color-text);
		font-weight: 600;
	}

	/* white on light mode needs the darker shade for 4.5:1; dark mode takes page-dark text instead */
	.status-fill {
		background-color: color-mix(in srgb, var(--status) 85%, black);
		color: #ffffff;
	}

	:global(html[data-mode='dark']) .status-fill {
		background-color: var(--status);
		color: var(--color-bg);
	}

	.check-icon {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.5rem;
		font-weight: 700;
	}
</style>
