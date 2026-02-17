<script lang="ts">
	import { queryByTopic, formatDuration, formatTimestamp } from '$api/mediathekview';
	import type { MediathekItem } from '$types';

	// Local state
	let searchTopic = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let results = $state<MediathekItem[]>([]);

	// Debounce timer
	let searchTimeout: ReturnType<typeof setTimeout>;

	// Handle search
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

<div class="sandbox-page">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Sandbox</h1>
		<p class="text-base-content/70">
			Teste MediathekViewWeb-Abfragen und analysiere die Ergebnisse.
		</p>
	</div>

	<!-- Search -->
	<div class="card bg-base-200 mb-6">
		<div class="card-body">
			<div class="form-control">
				<label class="label" for="sandbox-search">
					<span class="label-text">Topic suchen</span>
				</label>
				<div class="flex gap-2">
					<input
						id="sandbox-search"
						type="text"
						placeholder="z.B. Tatort, Der Bergdoktor..."
						class="input input-bordered flex-1"
						bind:value={searchTopic}
						oninput={handleSearch}
					/>
					{#if isLoading}
						<span class="loading loading-spinner loading-md"></span>
					{/if}
				</div>
			</div>
		</div>
	</div>

	{#if error}
		<div class="alert alert-error mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	{#if results.length > 0}
		<div class="mb-4">
			<span class="badge badge-lg">{results.length} Ergebnisse</span>
		</div>

		<!-- Results table -->
		<div class="overflow-x-auto">
			<table class="table table-sm bg-base-100">
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
						<tr class="hover">
							<td>
								<span class="badge badge-sm">{item.channel}</span>
							</td>
							<td class="max-w-[150px] truncate">{item.topic}</td>
							<td class="max-w-[300px]">
								<span class="truncate block" title={item.title}>{item.title}</span>
							</td>
							<td>{formatDuration(item.duration)}</td>
							<td class="text-sm">{formatTimestamp(item.timestamp)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if searchTopic.length >= 2 && !isLoading}
		<div class="text-center py-12 text-base-content/50">
			<p>Keine Ergebnisse für "{searchTopic}"</p>
		</div>
	{:else if !searchTopic}
		<div class="text-center py-12">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<p class="text-base-content/60">Gib einen Topic ein, um Mediathek-Inhalte zu durchsuchen.</p>
		</div>
	{/if}
</div>
