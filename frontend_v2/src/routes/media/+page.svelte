<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getAllMedia } from '$api/media';
	import { authStore, isAdmin } from '$stores/auth';
	import { newMediaDraftKey, suggestionDraft } from '$stores/suggestionDraft';
	import type { Media, MediaType } from '$types';
	import MediaCard from '$components/media/MediaCard.svelte';
	import AddMediaForm from '$components/media/AddMediaForm.svelte';
	import Input from '$components/ui/Input.svelte';
	import Button from '$components/ui/Button.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let mediaList = $state<Media[]>([]);
	let filterQuery = $state('');
	let filterType = $state<'all' | 'show' | 'movie'>('all');
	let showForm = $state(false);

	let filteredMedia = $derived(() => {
		let result = mediaList;

		if (filterQuery.trim()) {
			const query = filterQuery.toLowerCase();
			result = result.filter((m) => m.name.toLowerCase().includes(query));
		}

		if (filterType !== 'all') {
			result = result.filter((m) => m.type === filterType);
		}

		return result;
	});

	onMount(async () => {
		try {
			mediaList = await getAllMedia({ withSuggestionCounts: true });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden';
		} finally {
			isLoading = false;
		}
	});

	async function handleMediaCreated() {
		showForm = false;
		mediaList = await getAllMedia({ withSuggestionCounts: true });
	}

	async function handlePropose(picked: {
		name: string;
		type: MediaType;
		tvdbId?: number;
		tmdbId?: number;
		imdbId?: string;
	}) {
		const existing = mediaList.find(
			(m) =>
				m.type === picked.type &&
				(picked.type === 'show' ? m.tvdbId === picked.tvdbId : m.tmdbId === picked.tmdbId)
		);

		if (existing) {
			showForm = false;
			await goto(`/media/${existing.id}/rulesets?draft=1&exists=1`);
			return;
		}

		const key = newMediaDraftKey(picked);
		suggestionDraft.open(key, {
			proposedMedia: {
				name: picked.name,
				type: picked.type,
				tvdbId: picked.tvdbId ?? null,
				tmdbId: picked.tmdbId ?? null,
				imdbId: picked.imdbId ?? null
			}
		});
		suggestionDraft.setDescription(
			`${picked.type === 'show' ? 'Neue Serie' : 'Neuer Film'}: ${picked.name}` +
				`${picked.type === 'show' ? ` (TVDB ${picked.tvdbId})` : ` (TMDB ${picked.tmdbId})`} — erstes Ruleset`
		);
		showForm = false;
		await goto(`/media/new/${encodeURIComponent(key)}/rulesets`);
	}
</script>

<svelte:head>
	<title>Serien - MediathekArr</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
		<div>
			<h1 class="text-2xl font-bold">Serien</h1>
			<p class="text-text-secondary mt-1">Shows und Filme mit Rulesets verwalten</p>
		</div>

		{#if $isAdmin || $authStore.isAuthenticated}
			<Button variant="primary" onclick={() => { showForm = true; }}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
				</svg>
				{$isAdmin ? 'Hinzufügen' : 'Neue Serie/Film vorschlagen'}
			</Button>
		{/if}
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap gap-3">
		<div class="flex-1 min-w-[200px] max-w-sm">
			<Input placeholder="Liste filtern..." bind:value={filterQuery} />
		</div>
		<div>
			<select class="select" bind:value={filterType}>
				<option value="all">Alle Typen</option>
				<option value="show">Serien</option>
				<option value="movie">Filme</option>
			</select>
		</div>
	</div>

	<!-- Content -->
	<div class="flex flex-col lg:flex-row gap-6">
		{#if showForm && ($isAdmin || $authStore.isAuthenticated)}
			<div class="lg:w-1/3">
				<AddMediaForm
					onCreated={handleMediaCreated}
					onCancel={() => { showForm = false; }}
					onPick={$isAdmin ? undefined : handlePropose}
					submitLabel={$isAdmin ? 'Hinzufügen' : 'Vorschlagen'}
					title={$isAdmin ? 'Neue Serie' : 'Serie vorschlagen'}
				/>
			</div>
		{/if}

		<div class="flex-1">
			{#if isLoading}
				<div class="flex justify-center py-12">
					<Spinner size="lg" />
				</div>
			{:else if error}
				<Alert variant="error">{error}</Alert>
			{:else if filteredMedia().length === 0}
				<div class="text-center py-12">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-text-tertiary opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
					</svg>
					<p class="text-lg text-text-secondary">Keine Serie gefunden</p>
					<p class="text-sm text-text-tertiary mt-2">Suche oben nach einer Serie oder füge manuell hinzu</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
					{#each filteredMedia() as media}
						<MediaCard {media} />
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
