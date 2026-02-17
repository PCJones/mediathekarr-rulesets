<script lang="ts">
	import { getSuggestions, getVoteScore } from '$api/suggestions';
	import { isUser, isAdmin } from '$stores/auth';
	import type { Suggestion, SuggestionStatus } from '$types/suggestion';
	import SuggestionCard from '$components/suggestions/SuggestionCard.svelte';
	import Button from '$components/ui/Button.svelte';
	import Alert from '$components/ui/Alert.svelte';

	type FilterTab = 'all' | SuggestionStatus;
	type SortOption = 'newest' | 'votes';

	let activeFilter = $state<FilterTab>('all');
	let activeSort = $state<SortOption>('newest');

	let allSuggestions = $state<Suggestion[]>(getSuggestions());

	function refresh() {
		allSuggestions = getSuggestions();
	}

	let filtered = $derived.by(() => {
		let items = activeFilter === 'all'
			? allSuggestions
			: allSuggestions.filter(s => s.status === activeFilter);

		if (activeSort === 'votes') {
			items = [...items].sort((a, b) => getVoteScore(b) - getVoteScore(a));
		} else {
			items = [...items].sort((a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
		}

		return items;
	});

	const filterTabs: { key: FilterTab; label: string }[] = [
		{ key: 'all', label: 'Alle' },
		{ key: 'open', label: 'Offen' },
		{ key: 'accepted', label: 'Angenommen' },
		{ key: 'rejected', label: 'Abgelehnt' }
	];

	let openCount = $derived(allSuggestions.filter(s => s.status === 'open').length);
</script>

<svelte:head>
	<title>Vorschläge - MediathekArr</title>
</svelte:head>

<div class="space-y-6">
	<Alert variant="warning">
		<span class="text-base font-semibold">
			Achtung: Diese Seite zeigt derzeit nur Beispieldaten an. Die Vorschlagsfunktion ist noch nicht aktiv.
		</span>
	</Alert>

	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
		<div>
			<h1 class="text-2xl font-bold">Vorschläge</h1>
			<p class="text-sm text-text-secondary mt-1">
				{openCount} offene Vorschläge
			</p>
		</div>

		{#if $isUser || $isAdmin}
			<Button variant="primary" href="/suggestions/new">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
				</svg>
				Neuen Vorschlag erstellen
			</Button>
		{/if}
	</div>

	<!-- Filters and Sort -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
		<!-- Filter tabs -->
		<div class="flex gap-1 border border-border rounded-lg p-1">
			{#each filterTabs as tab}
				<button
					class="px-3 py-1.5 text-sm rounded-md transition-colors"
					class:bg-accent={activeFilter === tab.key}
					class:text-accent-text={activeFilter === tab.key}
					class:text-text-secondary={activeFilter !== tab.key}
					class:hover:text-text={activeFilter !== tab.key}
					onclick={() => activeFilter = tab.key}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Sort -->
		<div class="flex items-center gap-2 text-sm">
			<span class="text-text-tertiary">Sortierung:</span>
			<button
				class="px-2 py-1 rounded transition-colors"
				class:text-accent={activeSort === 'newest'}
				class:font-medium={activeSort === 'newest'}
				class:text-text-secondary={activeSort !== 'newest'}
				onclick={() => activeSort = 'newest'}
			>
				Neueste
			</button>
			<span class="text-text-tertiary">|</span>
			<button
				class="px-2 py-1 rounded transition-colors"
				class:text-accent={activeSort === 'votes'}
				class:font-medium={activeSort === 'votes'}
				class:text-text-secondary={activeSort !== 'votes'}
				onclick={() => activeSort = 'votes'}
			>
				Meiste Stimmen
			</button>
		</div>
	</div>

	<!-- Suggestion List -->
	{#if filtered.length === 0}
		<div class="text-center py-12 bg-surface rounded-lg border border-border">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto text-text-tertiary mb-3" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
			</svg>
			<p class="text-text-secondary mb-1">Keine Vorschläge gefunden</p>
			<p class="text-sm text-text-tertiary">
				{#if activeFilter !== 'all'}
					Versuche einen anderen Filter.
				{:else}
					Erstelle den ersten Vorschlag!
				{/if}
			</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each filtered as suggestion (suggestion.id)}
				<SuggestionCard {suggestion} />
			{/each}
		</div>
	{/if}
</div>
