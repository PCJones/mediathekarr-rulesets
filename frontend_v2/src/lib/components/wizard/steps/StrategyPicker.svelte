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
	<h2 class="text-xl font-bold mb-1">Matching-Strategie wählen</h2>
	<p class="text-text-secondary text-sm mb-4">
		Wähle, wie die Mediathek-Einträge mit TVDB-Episoden abgeglichen werden sollen.
	</p>

	<!-- No TVDB data info -->
	{#if !tvdbShowData}
		<div class="alert alert-info mb-4">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="shrink-0 w-5 h-5">
				<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<span>Keine TVDB-Daten verfügbar. Die Strategie-Auswahl basiert auf allgemeinen Empfehlungen.</span>
		</div>
	{/if}

	<!-- Strategy selection cards -->
	<div class="grid gap-2">
		{#each MATCHING_STRATEGIES as strategy}
			{@const isSelected = currentStrategy === strategy.value}
			<button
				class="card cursor-pointer text-left"
				class:ring-2={isSelected}
				class:ring-accent={isSelected}
				onclick={() => selectStrategy(strategy.value)}
			>
				<div class="card-body-sm">
					<div class="flex items-start gap-3">
						<!-- Radio indicator -->
						<div class="mt-0.5">
							<div
								class="w-4 h-4 rounded-full border-2 flex items-center justify-center"
								class:border-accent={isSelected}
								class:border-border={!isSelected}
							>
								{#if isSelected}
									<div class="w-2 h-2 rounded-full bg-accent"></div>
								{/if}
							</div>
						</div>

						<!-- Content -->
						<div class="flex-1">
							<h3 class="font-semibold">{strategy.label}</h3>
							<p class="text-text-secondary text-sm mt-0.5">{strategy.description}</p>

							<!-- Requirements -->
							<div class="flex flex-wrap gap-1.5 mt-2">
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

	<!-- TVDB Episode Structure Display (reference) -->
	{#if tvdbShowData}
		<div class="tvdb-section mt-6">
			<div class="flex items-center justify-between mb-3">
				<h3 class="font-semibold text-sm text-text-secondary uppercase tracking-wide flex items-center gap-2">
					TVDB-Episodenstruktur
					<span class="badge badge-sm">ID: {tvdbShowData.id}</span>
				</h3>
				<a
					href="https://www.thetvdb.com/?tab=series&id={tvdbShowData.id}"
					target="_blank"
					rel="noopener noreferrer"
					class="btn btn-ghost btn-sm text-text-tertiary"
				>
					Auf TVDB öffnen
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
						<path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
						<path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
					</svg>
				</a>
			</div>

			<!-- Season selector and options -->
			<div class="flex items-end gap-4 mb-3">
				{#if availableSeasons().length > 1}
					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-text-tertiary" for="season-select">
							Staffel
						</label>
						<select
							id="season-select"
							class="select input-sm w-44"
							bind:value={selectedSeason}
						>
							{#each availableSeasons() as season}
								<option value={season}>Staffel {season}</option>
							{/each}
						</select>
					</div>
				{:else if availableSeasons().length === 1}
					<p class="text-sm text-text-secondary">
						Nur 1 Staffel verfügbar
					</p>
				{/if}
				<label class="flex items-center cursor-pointer gap-2 pb-0.5">
					<input type="checkbox" class="accent-accent w-3.5 h-3.5" bind:checked={showAbsoluteNumbers} />
					<span class="text-xs text-text-secondary">Absolute Episodennummern</span>
				</label>
			</div>

			<!-- Episode table -->
			{#if filteredEpisodes().length > 0}
				<div class="overflow-x-auto max-h-[280px] overflow-y-auto rounded-md border border-border">
					<table class="data-table">
						<thead>
							<tr>
								<th class="w-12">S.</th>
								<th class="w-12">Ep.</th>
								{#if showAbsoluteNumbers}<th class="w-16">Abs.</th>{/if}
								<th>Name</th>
								<th class="w-28">Ausgestrahlt</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredEpisodes() as episode}
								<tr>
									<td class="tabular-nums">{episode.seasonNumber}</td>
									<td class="tabular-nums">{episode.episodeNumber}</td>
									{#if showAbsoluteNumbers}<td class="tabular-nums">{episode.absoluteNumber || '-'}</td>{/if}
									<td class="max-w-[260px] truncate" title={episode.name}>{episode.name}</td>
									<td class="tabular-nums text-text-secondary">{formatDate(episode.aired)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="text-text-tertiary text-sm">Keine Episoden für diese Staffel gefunden.</p>
			{/if}
		</div>
	{/if}

	<!-- Strategy explanation -->
	<details class="mt-6 rounded-lg border border-border bg-bg">
		<summary class="cursor-pointer font-medium px-4 py-3 text-sm">
			Wann welche Strategie verwenden?
		</summary>
		<div class="px-4 pb-4">
			<div class="overflow-x-auto rounded-md border border-border">
				<table class="data-table">
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
								<code class="text-xs bg-bg px-1 py-0.5 rounded">Feuer & Flamme (S08/E01)</code>
							</td>
							<td>
								<span class="text-xs">seasonNumber: <strong>8</strong>, episodeNumber: <strong>1</strong></span>
							</td>
						</tr>
						<tr>
							<td class="font-medium">Absolute Episodennummer</td>
							<td>
								<code class="text-xs bg-bg px-1 py-0.5 rounded">Sturm der Liebe Episode 4524</code>
							</td>
							<td>
								<span class="text-xs">absoluteNumber: <strong>4524</strong> (alle Folgen in Season 1)</span>
							</td>
						</tr>
						<tr>
							<td class="font-medium">Titel enthält</td>
							<td>
								<code class="text-xs bg-bg px-1 py-0.5 rounded">Tatort: Mord am See</code>
								<br /><span class="text-xs text-text-tertiary">-> extrahiert: "Mord am See"</span>
							</td>
							<td>
								<span class="text-xs">name enthält "<strong>Mord am See</strong>"</span>
							</td>
						</tr>
						<tr>
							<td class="font-medium">Titel exakt</td>
							<td>
								<code class="text-xs bg-bg px-1 py-0.5 rounded">Bibi Blocksberg: Der Wetterfrosch</code>
								<br /><span class="text-xs text-text-tertiary">-> extrahiert: "Der Wetterfrosch"</span>
							</td>
							<td>
								<span class="text-xs">name: "<strong>Der Wetterfrosch</strong>"</span>
							</td>
						</tr>
						<tr>
							<td class="font-medium">Ausstrahlungsdatum</td>
							<td>
								<code class="text-xs bg-bg px-1 py-0.5 rounded">ZDF Magazin Royale vom 6. November 2020</code>
								<br /><span class="text-xs text-text-tertiary">-> extrahiert: "6. November 2020"</span>
							</td>
							<td>
								<span class="text-xs">aired: "<strong>2020-11-06</strong>"</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</details>

	</div>
