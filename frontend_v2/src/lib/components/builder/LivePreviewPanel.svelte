<script lang="ts">
	import { getContext } from 'svelte';
	import { previewStore } from '$stores/preview';
	import { rulesetStore, wizardStore } from '$stores/ruleset';
	import { draftStore } from '$stores/draft';
	import { buildTitleFromRules } from '$utils/regex';
	import { matchEpisodeByStrategy, type TvdbMatchResult } from '$utils/tvdbMatcher';
	import type { Filter, MediathekItem, TitleConstructionStep, RegexRule, TvdbShowData, TvdbEpisode } from '$types';

	// Get TVDB data from wizard context
	const wizardCallbacks = getContext<{ tvdbShowData?: TvdbShowData | null }>('wizardCallbacks');
	let tvdbEpisodes = $derived(wizardCallbacks?.tvdbShowData?.episodes || []);

	// Subscribe to shared preview store
	let rawItems = $derived($previewStore.items);
	let isLoading = $derived($previewStore.isLoading);
	let error = $derived($previewStore.error);
	let totalFetched = $derived($previewStore.totalFetched);
	let autoFilteredCount = $derived($previewStore.filteredCount); // Audiodeskription/Gebärdensprache
	let hasMoreResults = $derived($previewStore.hasMoreResults);

	// Get filters and title rules from ruleset store
	let filters = $derived($rulesetStore.filters);
	let titleRules = $derived($rulesetStore.titleRegexRules);
	let currentStep = $derived($wizardStore.currentStep);
	let matchingStrategy = $derived($rulesetStore.matchingStrategy);
	let seasonRegex = $derived($rulesetStore.seasonRegex);
	let episodeRegex = $derived($rulesetStore.episodeRegex);

	// Get draft filter and title rule for real-time preview
	let draftFilter = $derived($draftStore.filter);
	let draftTitleRule = $derived($draftStore.titleRule);

	// Combine committed filters with draft filter for preview
	let allFilters = $derived.by((): Filter[] => {
		// Check if draft filter has a non-empty value (handle both string and number values)
		if (draftFilter && String(draftFilter.value).trim()) {
			return [...filters, draftFilter];
		}
		return filters;
	});

	// Combine committed title rules with draft rule for preview
	let allTitleRules = $derived.by((): RegexRule[] => {
		if (draftTitleRule) {
			// For static rules, check if value is non-empty
			if (draftTitleRule.type === 'static' && draftTitleRule.value?.trim()) {
				return [...titleRules, draftTitleRule];
			}
			// For regex rules, check if pattern is non-empty
			if (draftTitleRule.type === 'regex' && draftTitleRule.pattern?.trim()) {
				return [...titleRules, draftTitleRule];
			}
		}
		return titleRules;
	});

	// Show title construction when on step 3+ (titleRules step) and rules exist (including draft)
	let showConstruction = $derived(currentStep >= 3 && allTitleRules.length > 0);

	// Show season/episode extraction column in step 4
	let showSeasonEpisode = $derived(currentStep >= 4 && (seasonRegex || episodeRegex));

	// Show TVDB match column when on step 3+ and TVDB data is available
	let showTvdbMatch = $derived(currentStep >= 3 && tvdbEpisodes.length > 0);

	// Free text search
	let searchQuery = $state('');

	// Column widths for resizable columns (in pixels)
	let columnWidths = $state({
		sender: 80,
		topic: 120,
		title: 200,
		constructed: 180,
		seasonEpisode: 60,
		tvdbEpisode: 150,
		date: 90,
		duration: 70
	});

	// Minimum column widths
	const minWidths: Record<string, number> = {
		sender: 60,
		topic: 80,
		title: 120,
		constructed: 100,
		seasonEpisode: 50,
		tvdbEpisode: 80,
		date: 80,
		duration: 50
	};

	// Resize state
	let resizing = $state<{ column: string; startX: number; startWidth: number } | null>(null);

	function startResize(e: MouseEvent, column: string) {
		e.preventDefault();
		resizing = { column, startX: e.clientX, startWidth: columnWidths[column as keyof typeof columnWidths] };
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	function onMouseMove(e: MouseEvent) {
		if (!resizing) return;
		const delta = e.clientX - resizing.startX;
		const minWidth = minWidths[resizing.column] || 50;
		const newWidth = Math.max(minWidth, resizing.startWidth + delta);
		columnWidths[resizing.column as keyof typeof columnWidths] = newWidth;
	}

	function onMouseUp() {
		resizing = null;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	}

	// Extended item type with constructed title info and TVDB match
	interface ItemWithConstruction extends MediathekItem {
		constructedTitle: string | null;
		titleFailed: boolean;
		failedStep?: TitleConstructionStep;
		tvdbMatch: TvdbMatchResult | null;
		extractedSeason: string | null;
		extractedEpisode: string | null;
	}

	// Apply user filters to items
	function applyFilter(item: MediathekItem, filter: Filter): boolean {
		let fieldValue: string | number;

		if (filter.attribute === 'duration') {
			// Duration in store is minutes, item.duration is seconds
			fieldValue = Math.round(item.duration / 60);
			const filterVal = parseInt(filter.value, 10);
			if (isNaN(filterVal)) return true;

			switch (filter.type) {
				case 'GreaterThan': return fieldValue > filterVal;
				case 'LessThan': return fieldValue < filterVal;
				case 'Equals': return fieldValue === filterVal;
				default: return true;
			}
		} else {
			// String attributes
			fieldValue = item[filter.attribute as keyof MediathekItem] as string || '';
			const filterVal = filter.value;
			const fieldLower = fieldValue.toString().toLowerCase();

			switch (filter.type) {
				case 'Equals': return fieldLower === filterVal.toLowerCase();
				case 'Contains': return fieldLower.includes(filterVal.toLowerCase());
				case 'Regex':
					try {
						const regex = new RegExp(filterVal, 'i');
						return regex.test(fieldValue.toString());
					} catch {
						return true; // Invalid regex passes through
					}
				default: return true;
			}
		}
	}

	function applyAllFilters(item: MediathekItem): boolean {
		return allFilters.every(filter => applyFilter(item, filter));
	}

	// Apply free text search across multiple fields
	function matchesSearch(item: MediathekItem): boolean {
		if (!searchQuery.trim()) return true;
		const query = searchQuery.toLowerCase();
		const dateStr = formatDate(item.timestamp).toLowerCase();
		return (
			item.channel.toLowerCase().includes(query) ||
			item.topic.toLowerCase().includes(query) ||
			item.title.toLowerCase().includes(query) ||
			dateStr.includes(query)
		);
	}

	// Items after applying user filters and search
	let filteredItems = $derived(rawItems.filter(item => applyAllFilters(item) && matchesSearch(item)));
	let userFilteredCount = $derived(rawItems.length - filteredItems.length);

	// Compute constructed titles and TVDB matches for items when in step 3+
	let items = $derived.by((): ItemWithConstruction[] => {
		return filteredItems.map(item => {
			if (!showConstruction && !showTvdbMatch) {
				return {
					...item,
					constructedTitle: null,
					titleFailed: false,
					tvdbMatch: null,
					extractedSeason: null,
					extractedEpisode: null
				};
			}

			const { finalTitle, steps } = buildTitleFromRules(item, allTitleRules);
			const titleFailed = finalTitle === null && allTitleRules.length > 0;

			// Compute TVDB match if we have episodes
			let tvdbMatch: TvdbMatchResult | null = null;
			if (tvdbEpisodes.length > 0 && !titleFailed) {
				tvdbMatch = matchEpisodeByStrategy(
					item,
					tvdbEpisodes,
					matchingStrategy,
					allTitleRules,
					seasonRegex,
					episodeRegex
				);
			}

			return {
				...item,
				constructedTitle: finalTitle,
				titleFailed,
				failedStep: steps.find(s => !s.success),
				tvdbMatch,
				extractedSeason: tvdbMatch?.matchDetails.season?.toString() || null,
				extractedEpisode: tvdbMatch?.matchDetails.episode?.toString() || null
			};
		});
	});

	// Statistics for title construction
	let successCount = $derived(items.filter(i => showConstruction && !i.titleFailed).length);
	let failureCount = $derived(items.filter(i => showConstruction && i.titleFailed).length);

	// Statistics for TVDB matching
	let tvdbMatchCount = $derived(items.filter(i => i.tvdbMatch?.matched).length);
	let tvdbNoMatchCount = $derived(items.filter(i => !i.titleFailed && i.tvdbMatch && !i.tvdbMatch.matched).length);

	// Formatting helpers
	function formatDate(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleTimeString('de-DE', {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDuration(seconds: number): string {
		const totalMinutes = Math.round(seconds / 60);
		return `${totalMinutes} min`;
	}
</script>

<div class="live-preview-panel h-full flex flex-col">
	<!-- Header with stats -->
	<div class="mb-4">
		<div class="flex items-center gap-2 mb-2">
			<h3 class="font-bold text-lg">Live-Vorschau</h3>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
		</div>

		{#if rawItems.length > 0}
			<div class="flex flex-wrap items-center gap-1.5 text-xs">
				<span class="px-2 py-0.5 rounded bg-primary/15 text-primary font-medium">
					{items.length}{hasMoreResults ? '+' : ''} Ergebnisse
				</span>
				{#if userFilteredCount > 0}
					<span class="px-2 py-0.5 rounded bg-warning/15 text-warning font-medium" title="Durch deine Filter entfernt">
						-{userFilteredCount} Filter
					</span>
				{/if}
				{#if autoFilteredCount > 0}
					<span class="px-2 py-0.5 rounded bg-base-300 text-base-content/70 font-medium">
						-{autoFilteredCount} AD/GS
					</span>
				{/if}
				{#if showConstruction}
					{#if successCount > 0}
						<span class="px-2 py-0.5 rounded bg-success/15 text-success font-medium" title="Titel erfolgreich konstruiert">
							{successCount} konstruiert
						</span>
					{/if}
					{#if failureCount > 0}
						<span class="px-2 py-0.5 rounded bg-error/15 text-error font-medium" title="Titel-Konstruktion fehlgeschlagen">
							{failureCount} fehlgeschlagen
						</span>
					{/if}
				{/if}
				{#if showTvdbMatch}
					{#if tvdbMatchCount > 0}
						<span class="px-2 py-0.5 rounded bg-info/15 text-info font-medium" title="TVDB-Episoden gefunden">
							{tvdbMatchCount} TVDB
						</span>
					{/if}
					{#if tvdbNoMatchCount > 0}
						<span class="px-2 py-0.5 rounded bg-warning/15 text-warning font-medium" title="Keine TVDB-Episode gefunden">
							{tvdbNoMatchCount} kein Match
						</span>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Search input -->
	{#if rawItems.length > 0}
		<div class="mb-3">
			<input
				type="text"
				class="input input-bordered input-sm w-full"
				placeholder="Suche in Sender, Topic, Titel, Datum..."
				bind:value={searchQuery}
			/>
		</div>
	{/if}

	<!-- Content area -->
	<div class="flex-1 overflow-y-auto min-h-0">
		{#if error}
			<div class="alert alert-warning">
				<span>{error}</span>
			</div>
		{:else if items.length > 0}
			<div class="overflow-x-auto">
				<table class="table table-xs table-zebra table-fixed w-full">
					<colgroup>
						<col style="width: {columnWidths.sender}px" />
						<col style="width: {columnWidths.topic}px" />
						<col style="width: {columnWidths.title}px" />
						{#if showConstruction}
							<col style="width: {columnWidths.constructed}px" />
						{/if}
						{#if showSeasonEpisode}
							<col style="width: {columnWidths.seasonEpisode}px" />
						{/if}
						{#if showTvdbMatch}
							<col style="width: {columnWidths.tvdbEpisode}px" />
						{/if}
						<col style="width: {columnWidths.date}px" />
						<col style="width: {columnWidths.duration}px" />
					</colgroup>
					<thead class="sticky top-0 bg-base-200 z-10">
						<tr>
							<th class="resize-th">
								Sender
								<div class="resize-handle" onmousedown={(e) => startResize(e, 'sender')}></div>
							</th>
							<th class="resize-th">
								Topic
								<div class="resize-handle" onmousedown={(e) => startResize(e, 'topic')}></div>
							</th>
							<th class="resize-th">
								Titel
								<div class="resize-handle" onmousedown={(e) => startResize(e, 'title')}></div>
							</th>
							{#if showConstruction}
								<th class="resize-th">
									Konstruiert
									<div class="resize-handle" onmousedown={(e) => startResize(e, 'constructed')}></div>
								</th>
							{/if}
							{#if showSeasonEpisode}
								<th class="resize-th">
									S/E
									<div class="resize-handle" onmousedown={(e) => startResize(e, 'seasonEpisode')}></div>
								</th>
							{/if}
							{#if showTvdbMatch}
								<th class="resize-th">
									TVDB Episode
									<div class="resize-handle" onmousedown={(e) => startResize(e, 'tvdbEpisode')}></div>
								</th>
							{/if}
							<th class="resize-th">
								Datum
								<div class="resize-handle" onmousedown={(e) => startResize(e, 'date')}></div>
							</th>
							<th>Dauer</th>
						</tr>
					</thead>
					<tbody>
						{#each items as item}
							<tr class:opacity-50={showConstruction && item.titleFailed}>
								<td class="truncate overflow-hidden"><span class="badge badge-sm">{item.channel}</span></td>
								<td class="truncate overflow-hidden" title={item.topic}>{item.topic}</td>
								<td class="truncate overflow-hidden" title={item.title}>
									{#if showConstruction && item.titleFailed}
										<span class="line-through text-error">{item.title}</span>
									{:else}
										{item.title}
									{/if}
								</td>
								{#if showConstruction}
									<td class="overflow-hidden">
										{#if item.constructedTitle}
											<span class="flex items-center gap-1" title={item.constructedTitle}>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-success shrink-0" viewBox="0 0 20 20" fill="currentColor">
													<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
												</svg>
												<span class="truncate">{item.constructedTitle}</span>
											</span>
										{:else if item.titleFailed}
											<span class="flex items-center gap-1 text-error" title={item.failedStep?.error || 'Konstruktion fehlgeschlagen'}>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
													<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
												</svg>
												<span class="text-xs truncate">{item.failedStep?.error || 'Fehler'}</span>
											</span>
										{:else}
											<span class="text-base-content/40">-</span>
										{/if}
									</td>
								{/if}
								{#if showSeasonEpisode}
									<td class="overflow-hidden">
										{#if item.extractedSeason !== null || item.extractedEpisode !== null}
											<span class="font-mono text-success">
												{#if item.extractedSeason !== null}S{item.extractedSeason.padStart(2, '0')}{/if}{#if item.extractedEpisode !== null}E{item.extractedEpisode.padStart(2, '0')}{/if}
											</span>
										{:else if item.titleFailed}
											<span class="text-base-content/40">-</span>
										{:else}
											<span class="text-error text-xs">Fehler</span>
										{/if}
									</td>
								{/if}
								{#if showTvdbMatch}
									<td class="overflow-hidden">
										{#if item.tvdbMatch?.matched && item.tvdbMatch.episode}
											<span class="flex items-center gap-1 text-success" title={`S${item.tvdbMatch.episode.seasonNumber}E${item.tvdbMatch.episode.episodeNumber}: ${item.tvdbMatch.episode.name}`}>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
													<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
												</svg>
												<span class="truncate">{item.tvdbMatch.episode.name}</span>
											</span>
										{:else if item.titleFailed}
											<span class="text-base-content/40">-</span>
										{:else if item.tvdbMatch && !item.tvdbMatch.matched}
											<span class="flex items-center gap-1 text-warning" title={item.tvdbMatch.error || 'Keine Episode gefunden'}>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
													<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
												</svg>
												<span class="text-xs truncate">Kein Match</span>
											</span>
										{:else}
											<span class="text-base-content/40">-</span>
										{/if}
									</td>
								{/if}
								<td class="whitespace-nowrap">{formatDate(item.timestamp)}</td>
								<td class="whitespace-nowrap">{formatDuration(item.duration)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if isLoading}
			<div class="flex justify-center items-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-12 text-base-content/50">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<p class="font-medium">Keine Vorschau-Daten</p>
				<p class="text-sm mt-1">Gib Topics in Schritt 1 ein</p>
			</div>
		{/if}
	</div>

	<!-- Footer with additional info -->
	{#if (autoFilteredCount > 0 || userFilteredCount > 0) && rawItems.length > 0}
		<div class="mt-4 text-sm text-base-content/60 space-y-1">
			{#if userFilteredCount > 0}
				<div>{userFilteredCount} durch deine Filter entfernt</div>
			{/if}
			{#if autoFilteredCount > 0}
				<div>{autoFilteredCount} Audiodeskription/Gebärdensprache ausgeblendet</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.resize-th {
		position: relative;
		padding-right: 12px;
	}

	.resize-handle {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 8px;
		cursor: col-resize;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Vertical grip line indicator */
	.resize-handle::after {
		content: '';
		width: 2px;
		height: 16px;
		background: oklch(var(--bc) / 0.2);
		border-radius: 1px;
		transition: all 0.15s ease;
	}

	.resize-handle:hover::after {
		background: oklch(var(--bc) / 0.5);
		height: 20px;
	}

	.resize-handle:active::after {
		background: oklch(var(--p));
		height: 100%;
	}
</style>
