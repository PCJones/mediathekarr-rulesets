<script lang="ts">
	import { queryByTopic, formatDuration, formatTimestamp } from '$api/mediathekview';
	import type { MediathekItem } from '$types';
	import Card from '$components/ui/Card.svelte';
	import Input from '$components/ui/Input.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	let searchTopic = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let results = $state<MediathekItem[]>([]);

	let searchTimeout: ReturnType<typeof setTimeout>;

	function handleSearch() {
		error = null;

		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		if (searchTopic.trim().length < 2) {
			results = [];
			return;
		}

		searchTimeout = setTimeout(async () => {
			isLoading = true;
			try {
				results = await queryByTopic(searchTopic, { size: 100 });
			} catch (e) {
				error = e instanceof Error ? e.message : 'Fehler beim Laden';
				results = [];
			} finally {
				isLoading = false;
			}
		}, 500);
	}
</script>

<svelte:head>
	<title>Sandbox - MediathekArr</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Sandbox</h1>
		<p class="text-text-secondary mt-1">
			Teste MediathekViewWeb-Abfragen und analysiere die Ergebnisse.
		</p>
	</div>

	<!-- Search -->
	<Card>
		<div class="flex items-end gap-3">
			<div class="flex-1">
				<Input
					label="Topic suchen"
					placeholder="z.B. Tatort, Der Bergdoktor..."
					bind:value={searchTopic}
					oninput={handleSearch}
				/>
			</div>
			{#if isLoading}
				<div class="pb-1">
					<Spinner size="sm" />
				</div>
			{/if}
		</div>
	</Card>

	{#if error}
		<Alert variant="error">{error}</Alert>
	{/if}

	{#if results.length > 0}
		<div class="flex items-center gap-3">
			<Badge size="lg">{results.length} Ergebnisse</Badge>
		</div>

		<div class="overflow-x-auto rounded-lg border border-border">
			<table class="data-table">
				<thead>
					<tr>
						<th>Sender</th>
						<th>Topic</th>
						<th>Titel</th>
						<th>Dauer</th>
						<th>Datum</th>
					</tr>
				</thead>
				<tbody>
					{#each results as item}
						<tr>
							<td>
								<Badge size="sm">{item.channel}</Badge>
							</td>
							<td class="max-w-[150px] truncate">{item.topic}</td>
							<td class="max-w-[300px]">
								<span class="truncate block" title={item.title}>{item.title}</span>
							</td>
							<td class="whitespace-nowrap">{formatDuration(item.duration)}</td>
							<td class="whitespace-nowrap">{formatTimestamp(item.timestamp)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if searchTopic.length >= 2 && !isLoading}
		<div class="text-center py-12 text-text-tertiary">
			<p>Keine Ergebnisse für "{searchTopic}"</p>
		</div>
	{:else if !searchTopic}
		<div class="text-center py-12">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-text-tertiary opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<p class="text-text-secondary">Gib ein Topic ein, um Mediathek-Inhalte zu durchsuchen.</p>
		</div>
	{/if}
</div>
