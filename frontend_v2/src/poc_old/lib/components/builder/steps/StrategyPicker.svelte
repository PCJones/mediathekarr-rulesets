<script lang="ts">
	import { getContext } from 'svelte';
	import { rulesetStore } from '$stores/ruleset';
	import { MATCHING_STRATEGIES, type MatchingStrategy, type TvdbShowData, type TvdbEpisode } from '$types';

	// Get context from WizardBuilder
	const ctx = getContext<{ tvdbShowData: TvdbShowData | null }>('wizardCallbacks');
	let tvdbShowData = $derived(ctx?.tvdbShowData);

	// Get current strategy from store
	let currentStrategy = $derived($rulesetStore.matchingStrategy);

	// Season handling for TVDB display
	let availableSeasons = $derived(() => {
		if (!tvdbShowData?.episodes) return [];
		const seasons = [...new Set(tvdbShowData.episodes.map(e => e.seasonNumber))].sort((a, b) => a - b);
		return seasons;
	});

	// Default to highest season
	let selectedSeason = $state<number | null>(null);
	let showAbsoluteNumbers = $state(false);

	// Initialize selected season when data becomes available
	$effect(() => {
		const seasons = availableSeasons();
		if (seasons.length > 0 && selectedSeason === null) {
			selectedSeason = seasons[seasons.length - 1]; // Highest season
		}
	});

	// Filter episodes by selected season
	let filteredEpisodes = $derived(() => {
		if (!tvdbShowData?.episodes || selectedSeason === null) return [];
		return tvdbShowData.episodes
			.filter(e => e.seasonNumber === selectedSeason)
			.sort((a, b) => a.episodeNumber - b.episodeNumber);
	});

	// Handle strategy selection
	function selectStrategy(strategy: MatchingStrategy) {
		rulesetStore.setMatchingStrategy(strategy);
	}

	// Format date for display
	function formatDate(dateStr: string): string {
		if (!dateStr) return '-';
		try {
			return new Date(dateStr).toLocaleDateString('de-DE', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}
</script>

<div class="strategy-picker">
	<h2 class="text-2xl font-bold mb-2">Matching-Strategie wählen</h2>
	<p class="text-base-content/70 mb-6">
		Wähle, wie die Mediathek-Einträge mit TVDB-Episoden abgeglichen werden sollen.
		Die Strategie bestimmt, welche zusätzlichen Konfigurationen nötig sind.
	</p>

	<!-- TVDB Episode Structure Display -->
	{#if tvdbShowData}
		<div class="tvdb-section card bg-base-100 mb-6">
			<div class="card-body">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
					<h3 class="card-title text-lg flex items-center gap-2">
						<span>📺</span>
						<span>TVDB-Episodenstruktur</span>
						<span class="badge badge-ghost badge-sm">ID: {tvdbShowData.id}</span>
					</h3>
					<a
						href="https://www.thetvdb.com/?tab=series&id={tvdbShowData.id}"
						target="_blank"
						rel="noopener noreferrer"
						class="btn btn-ghost btn-sm"
					>
						Auf TVDB öffnen
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
							<path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
							<path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
						</svg>
					</a>
				</div>

				<!-- Season selector and options -->
				<div class="flex items-end gap-4 mb-4">
					{#if availableSeasons().length > 1}
						<div class="form-control">
							<label class="label" for="season-select">
								<span class="label-text">Staffel anzeigen</span>
							</label>
							<select
								id="season-select"
								class="select select-bordered select-sm w-48"
								bind:value={selectedSeason}
							>
								{#each availableSeasons() as season}
									<option value={season}>Staffel {season}</option>
								{/each}
							</select>
						</div>
					{:else if availableSeasons().length === 1}
						<p class="text-sm text-base-content/70">
							Nur 1 Staffel verfügbar
						</p>
					{/if}
					<label class="label cursor-pointer gap-2 pb-1">
						<input type="checkbox" class="checkbox checkbox-sm" bind:checked={showAbsoluteNumbers} />
						<span class="label-text">Zeige absolute Episodennummern</span>
					</label>
				</div>

				<!-- Episode table -->
				{#if filteredEpisodes().length > 0}
					<div class="overflow-x-auto max-h-[300px] overflow-y-auto">
						<table class="table table-xs table-zebra">
							<thead class="sticky top-0 bg-base-100">
								<tr>
									<th>S.</th>
									<th>Ep.</th>
									{#if showAbsoluteNumbers}<th>Absolut</th>{/if}
									<th>Name</th>
									<th>Ausgestrahlt</th>
								</tr>
							</thead>
							<tbody>
								{#each filteredEpisodes() as episode}
									<tr>
										<td>{episode.seasonNumber}</td>
										<td>{episode.episodeNumber}</td>
										{#if showAbsoluteNumbers}<td>{episode.absoluteNumber || '-'}</td>{/if}
										<td class="max-w-[300px] truncate" title={episode.name}>{episode.name}</td>
										<td>{formatDate(episode.aired)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="text-base-content/60 text-sm">Keine Episoden für diese Staffel gefunden.</p>
				{/if}
			</div>
		</div>
	{:else}
		<div class="alert mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<span>Keine TVDB-Daten verfügbar. Die Strategie-Auswahl basiert auf allgemeinen Empfehlungen.</span>
		</div>
	{/if}

	<div class="grid gap-4">
		{#each MATCHING_STRATEGIES as strategy}
			{@const isSelected = currentStrategy === strategy.value}
			<button
				class="card bg-base-100 cursor-pointer transition-shadow hover:shadow-md text-left"
				class:ring-2={isSelected}
				class:ring-primary={isSelected}
				onclick={() => selectStrategy(strategy.value)}
			>
				<div class="card-body py-4">
					<div class="flex items-start gap-4">
						<!-- Radio indicator -->
						<div class="mt-1">
							<div
								class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
								class:border-primary={isSelected}
								class:border-base-300={!isSelected}
							>
								{#if isSelected}
									<div class="w-3 h-3 rounded-full bg-primary"></div>
								{/if}
							</div>
						</div>

						<!-- Content -->
						<div class="flex-1">
							<h3 class="font-bold text-lg">{strategy.label}</h3>
							<p class="text-base-content/70 mt-1">{strategy.description}</p>

							<!-- Requirements -->
							<div class="flex flex-wrap gap-2 mt-3">
								{#if strategy.requiresSeasonRegex}
									<span class="badge badge-warning badge-sm">Season-Regex erforderlich</span>
								{/if}
								{#if strategy.requiresEpisodeRegex}
									<span class="badge badge-warning badge-sm">Episode-Regex erforderlich</span>
								{/if}
								{#if strategy.requiresTitleRules}
									<span class="badge badge-warning badge-sm">Titel-Regeln erforderlich</span>
								{/if}
								{#if !strategy.requiresSeasonRegex && !strategy.requiresEpisodeRegex && !strategy.requiresTitleRules}
									<span class="badge badge-success badge-sm">Keine zusätzliche Konfiguration</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</button>
		{/each}
	</div>

	<!-- Strategy explanation -->
	<div class="collapse collapse-arrow bg-base-100 mt-6">
		<input type="checkbox" />
		<div class="collapse-title font-medium">
			Wann welche Strategie verwenden?
		</div>
		<div class="collapse-content">
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Strategie</th>
							<th>Mediathek-Titel</th>
							<th>TVDB-Struktur</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="font-medium">Season + Episode</td>
							<td>
								<code class="text-xs">Feuer & Flamme (S08/E01)</code>
							</td>
							<td>
								<span class="text-xs">seasonNumber: <strong>8</strong>, episodeNumber: <strong>1</strong></span>
							</td>
						</tr>
						<tr>
							<td class="font-medium">Absolute Episodennummer</td>
							<td>
								<code class="text-xs">Sturm der Liebe Episode 4524</code>
							</td>
							<td>
								<span class="text-xs">absoluteNumber: <strong>4524</strong> (alle Folgen in Season 1)</span>
							</td>
						</tr>
						<tr>
							<td class="font-medium">Titel enthält</td>
							<td>
								<code class="text-xs">Tatort: Mord am See</code>
								<br /><span class="text-xs text-base-content/60">→ extrahiert: "Mord am See"</span>
							</td>
							<td>
								<span class="text-xs">name enthält "<strong>Mord am See</strong>"</span>
							</td>
						</tr>
						<tr>
							<td class="font-medium">Titel exakt</td>
							<td>
								<code class="text-xs">Bibi Blocksberg: Der Wetterfrosch</code>
								<br /><span class="text-xs text-base-content/60">→ extrahiert: "Der Wetterfrosch"</span>
							</td>
							<td>
								<span class="text-xs">name: "<strong>Der Wetterfrosch</strong>"</span>
							</td>
						</tr>
						<tr>
							<td class="font-medium">Ausstrahlungsdatum</td>
							<td>
								<code class="text-xs">ZDF Magazin Royale vom 6. November 2020</code>
								<br /><span class="text-xs text-base-content/60">→ extrahiert: "6. November 2020"</span>
							</td>
							<td>
								<span class="text-xs">aired: "<strong>2020-11-06</strong>"</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>

	</div>
