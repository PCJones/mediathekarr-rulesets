<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getSuggestions, type SuggestionSort } from '$api/suggestions';
	import { getMedia } from '$api/media';
	import type { SuggestionStatus, SuggestionSummary } from '$types/suggestion';
	import { authStore } from '$stores/auth';
	import SuggestionRow from '$components/suggestions/SuggestionRow.svelte';
	import Button from '$components/ui/Button.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	type FilterTab = 'all' | SuggestionStatus;

	const filterTabs: { key: FilterTab; label: string }[] = [
		{ key: 'open', label: 'Offen' },
		{ key: 'accepted', label: 'Angenommen' },
		{ key: 'rejected', label: 'Abgelehnt' },
		{ key: 'withdrawn', label: 'Zurückgezogen' },
		{ key: 'all', label: 'Alle' }
	];

	const sortOptions: { key: SuggestionSort; label: string }[] = [
		{ key: 'newest', label: 'Neueste' },
		{ key: 'votes', label: 'Meiste Stimmen' },
		{ key: 'updated', label: 'Zuletzt aktualisiert' }
	];

	const PAGE_SIZE = 20;

	let params = $derived($page.url.searchParams);
	let tab = $derived<FilterTab>((params.get('status') as FilterTab) || 'open');
	let mine = $derived(params.get('author') === 'me');
	let sort = $derived<SuggestionSort>((params.get('sort') as SuggestionSort) || 'newest');
	let mediaId = $derived(params.get('mediaId') ? Number(params.get('mediaId')) : null);

	let suggestions = $state<SuggestionSummary[]>([]);
	let total = $state(0);
	let totalPages = $state(1);
	let currentPage = $state(1);
	let isLoading = $state(true);
	let isLoadingMore = $state(false);
	let error = $state<string | null>(null);
	let loadMoreError = $state<string | null>(null);
	let resolvedMedia = $state<{ id: number; name: string } | null>(null);
	let mediaName = $derived(resolvedMedia && resolvedMedia.id === mediaId ? resolvedMedia.name : null);

	function updateQuery(patch: Record<string, string | null>) {
		const next = new URLSearchParams($page.url.searchParams);
		for (const [key, value] of Object.entries(patch)) {
			if (value === null) next.delete(key);
			else next.set(key, value);
		}
		const qs = next.toString();
		goto(`/suggestions${qs ? `?${qs}` : ''}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	async function fetchPage(pageNumber: number) {
		return getSuggestions({
			status: tab === 'all' ? undefined : tab,
			mediaId: mediaId ?? undefined,
			author: mine ? 'me' : undefined,
			sort,
			page: pageNumber,
			pageSize: PAGE_SIZE
		});
	}

	async function load() {
		isLoading = true;
		error = null;
		loadMoreError = null;
		try {
			const result = await fetchPage(1);
			suggestions = result.suggestions;
			total = result.total;
			totalPages = result.totalPages;
			currentPage = result.page;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Vorschläge konnten nicht geladen werden';
			suggestions = [];
			total = 0;
		} finally {
			isLoading = false;
		}
	}

	async function loadMore() {
		isLoadingMore = true;
		loadMoreError = null;
		try {
			const result = await fetchPage(currentPage + 1);
			suggestions = [...suggestions, ...result.suggestions];
			currentPage = result.page;
			totalPages = result.totalPages;
			total = result.total;
		} catch (e) {
			loadMoreError = e instanceof Error ? e.message : 'Weitere Vorschläge konnten nicht geladen werden';
		} finally {
			isLoadingMore = false;
		}
	}

	$effect(() => {
		// re-run whenever any query-backed filter changes
		void tab;
		void mine;
		void sort;
		void mediaId;
		load();
	});

	$effect(() => {
		const id = mediaId;
		if (id === null) return;
		const known = untrack(() => resolvedMedia);
		const fromRow = suggestions.find((s) => s.media?.id === id)?.media?.name;
		if (fromRow) {
			if (known?.id !== id || known.name !== fromRow) resolvedMedia = { id, name: fromRow };
			return;
		}
		if (known?.id === id) return;
		getMedia(id)
			.then((media) => {
				resolvedMedia = { id, name: media.name };
			})
			.catch(() => {
				resolvedMedia = { id, name: `#${id}` };
			});
	});
</script>

<svelte:head>
	<title>{mediaId !== null && mediaName ? `Vorschläge für ${mediaName}` : 'Vorschläge'} - MediathekArr</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
		<div>
			<h1 class="text-2xl font-bold">Vorschläge</h1>
			{#if mediaId !== null}
				<p class="text-text-secondary mt-1">
					Nur Vorschläge für
					<a href="/media/{mediaId}/rulesets" class="font-semibold text-text hover:text-accent transition-colors">{mediaName ?? `#${mediaId}`}</a>
					·
					<button type="button" class="text-accent hover:underline" onclick={() => updateQuery({ mediaId: null })}>
						Alle Serien anzeigen
					</button>
				</p>
			{:else}
				<p class="text-text-secondary mt-1">Community-Änderungen an Rulesets</p>
			{/if}
			<p class="text-sm text-text-tertiary mt-1">
				Vorschläge entstehen auf der <a href="/media" class="text-accent hover:underline">Serien-Seite</a>:
				Ruleset bearbeiten → Vorschlag einreichen.
			</p>
		</div>

		{#if $authStore.isAuthenticated}
			<div class="flex gap-1 border border-border rounded-lg p-1">
				<button
					class="px-3 py-1.5 text-sm rounded-md transition-colors"
					class:bg-accent={!mine}
					class:text-accent-text={!mine}
					class:text-text-secondary={mine}
					onclick={() => updateQuery({ author: null })}
				>
					Alle
				</button>
				<button
					class="px-3 py-1.5 text-sm rounded-md transition-colors"
					class:bg-accent={mine}
					class:text-accent-text={mine}
					class:text-text-secondary={!mine}
					onclick={() => updateQuery({ author: 'me' })}
				>
					Meine
				</button>
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<div class="flex gap-1 border border-border rounded-lg p-1">
			{#each filterTabs as filterTab (filterTab.key)}
				<button
					class="px-3 py-1.5 text-sm rounded-md transition-colors"
					class:bg-accent={tab === filterTab.key}
					class:text-accent-text={tab === filterTab.key}
					class:text-text-secondary={tab !== filterTab.key}
					onclick={() => updateQuery({ status: filterTab.key === 'open' ? null : filterTab.key })}
				>
					{filterTab.label}
				</button>
			{/each}
		</div>

		<div class="md:ml-auto flex flex-wrap items-center gap-3">
			<select
				class="select w-auto"
				aria-label="Sortierung"
				value={sort}
				onchange={(e) => updateQuery({ sort: e.currentTarget.value })}
			>
				{#each sortOptions as option (option.key)}
					<option value={option.key}>{option.label}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if error}
		<Alert variant="error">{error}</Alert>
	{:else if isLoading}
		<div class="flex justify-center py-12"><Spinner size="lg" /></div>
	{:else if suggestions.length === 0}
		<div class="text-center py-12">
			<svg
				class="h-16 w-16 mx-auto mb-4 text-text-tertiary opacity-40"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
				/>
			</svg>
			<p class="text-lg text-text-secondary">Keine Vorschläge gefunden</p>
			<p class="text-sm text-text-tertiary mt-2">
				Vorschläge entstehen auf der Media-Seite: Ruleset bearbeiten → Vorschlag einreichen.
				<a href="/media" class="text-accent hover:underline">Zu den Serien</a>
			</p>
		</div>
	{:else}
		<p class="text-sm text-text-tertiary">{total} {total === 1 ? 'Vorschlag' : 'Vorschläge'}</p>

		<div class="space-y-3">
			{#each suggestions as suggestion (suggestion.id)}
				<SuggestionRow {suggestion} />
			{/each}
		</div>

		{#if currentPage < totalPages}
			<div class="flex flex-col items-center gap-2">
				{#if loadMoreError}
					<p class="text-xs text-error">{loadMoreError}</p>
				{/if}
				<Button variant="secondary" loading={isLoadingMore} onclick={loadMore}>Weitere laden</Button>
			</div>
		{/if}
	{/if}
</div>
