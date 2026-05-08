<script lang="ts">
	import { getContext } from 'svelte';
	import { untrack } from 'svelte';
	import { previewStore } from '$stores/preview';
	import { rulesetStore, wizardStore } from '$stores/ruleset';
	import { draftStore } from '$stores/draft';
	import {
		coverageStore,
		coveredItemCount,
		isEvaluatingCoverage,
		simulatedRulesets,
		currentSimulatedPriority,
		simulationKey,
		NEW_RULESET_SENTINEL_ID
	} from '$stores/coverage';
	import { buildTitleFromRules } from '$utils/regex';
	import { matchEpisodeByStrategy, type TvdbMatchResult } from '$utils/tvdbMatcher';
	import type { Filter, MediathekItem, TitleConstructionStep, RegexRule, TvdbShowData, TvdbEpisode } from '$types';
	import Badge from '$components/ui/Badge.svelte';
	import Spinner from '$components/ui/Spinner.svelte';
	import Tooltip from '$components/ui/Tooltip.svelte';
	import CoverageSimulator from './CoverageSimulator.svelte';

	// Get TVDB data from wizard context
	const wizardCallbacks = getContext<{ tvdbShowData?: TvdbShowData | null }>('wizardCallbacks');
	let tvdbEpisodes = $derived(wizardCallbacks?.tvdbShowData?.episodes || []);

	// Subscribe to shared preview store
	let rawItems = $derived($previewStore.items);
	let isLoading = $derived($previewStore.isLoading);
	let error = $derived($previewStore.error);
	let totalFetched = $derived($previewStore.totalFetched);
	let autoFilteredCount = $derived($previewStore.filteredCount);
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

	// Coverage data
	let coverageMap = $derived($coverageStore.coverageMap);
	let currentRulesetId = $derived($coverageStore.currentRulesetId);
	let simRulesets = $derived($simulatedRulesets);
	// True when there are other rulesets beyond just the current one
	let hasOtherRulesets = $derived(simRulesets.filter(s => s.id !== currentRulesetId).length > 0);
	// True when simulation has any entries (show drawer button)
	let hasAnyRulesets = $derived(simRulesets.length > 0);
	let isEvaluating = $derived($isEvaluatingCoverage);
	let currentPriority = $derived($currentSimulatedPriority);
	let simKey = $derived($simulationKey);

	// UI state
	let hideClaimed = $state(false);
	let showDrawer = $state(false);

	// Combine committed filters with draft filter for preview
	let allFilters = $derived.by((): Filter[] => {
		if (draftFilter && String(draftFilter.value).trim()) {
			return [...filters, draftFilter];
		}
		return filters;
	});

	// Combine committed title rules with draft rule for preview
	let allTitleRules = $derived.by((): RegexRule[] => {
		if (draftTitleRule) {
			if (draftTitleRule.type === 'static' && draftTitleRule.value?.trim()) {
				return [...titleRules, draftTitleRule];
			}
			if (draftTitleRule.type === 'regex' && draftTitleRule.pattern?.trim()) {
				return [...titleRules, draftTitleRule];
			}
		}
		return titleRules;
	});

	let showConstruction = $derived(currentStep >= 3 && allTitleRules.length > 0);
	let showSeasonEpisode = $derived(currentStep >= 4 && (seasonRegex || episodeRegex));
	let showTvdbMatch = $derived(currentStep >= 3 && tvdbEpisodes.length > 0);

	// Search
	let searchQuery = $state('');

	// Column widths for resizable columns
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

	// Apply filter to an item
	function applyFilter(item: MediathekItem, filter: Filter): boolean {
		let fieldValue: string | number;

		if (filter.attribute === 'duration') {
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
			fieldValue = item[filter.attribute as keyof MediathekItem] as string || '';
			const filterVal = filter.value;
			const fieldLower = fieldValue.toString().toLowerCase();

			switch (filter.type) {
				case 'Equals': return fieldLower === filterVal.toLowerCase();
				case 'Contains': return fieldLower.includes(filterVal.toLowerCase());
				case 'Regex':
					try {
						return new RegExp(filterVal, 'i').test(fieldValue.toString());
					} catch {
						return true;
					}
				default: return true;
			}
		}
	}

	function applyAllFilters(item: MediathekItem): boolean {
		return allFilters.every(filter => applyFilter(item, filter));
	}

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

	let filteredItems = $derived(rawItems.filter(item => applyAllFilters(item) && matchesSearch(item)));
	let userFilteredCount = $derived(rawItems.length - filteredItems.length);

	// Evaluate coverage when items OR simulation state changes.
	// untrack the store write to avoid write-during-read reactivity issues.
	$effect(() => {
		const items = filteredItems;
		const _simKey = simKey; // Read to establish dependency on simulation changes
		untrack(() => {
			if (items.length > 0) {
				coverageStore.evaluate(items);
			}
		});
	});

	// Coverage status helpers
	type CoverageStatus = 'claimed-higher' | 'claimed-same' | 'claimed-lower' | null;

	function getCoverageStatus(itemId: string): CoverageStatus {
		const matches = coverageMap.get(itemId);
		if (!matches || matches.length === 0) return null;

		// Check for highest-priority match
		const bestMatch = matches[0]; // already sorted by priority
		if (bestMatch.priority < currentPriority) return 'claimed-higher';
		if (bestMatch.priority === currentPriority) return 'claimed-same';
		return 'claimed-lower';
	}

	function getCoverageMatches(itemId: string) {
		return coverageMap.get(itemId) || [];
	}

	// Compute constructed titles and TVDB matches
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

	// Display items: optionally filter out claimed-higher
	let displayItems = $derived.by(() => {
		if (!hideClaimed) return items;
		return items.filter(item => getCoverageStatus(item.id) !== 'claimed-higher');
	});

	let hiddenClaimedCount = $derived(items.length - displayItems.length);

	// Statistics
	let successCount = $derived(items.filter(i => showConstruction && !i.titleFailed).length);
	let failureCount = $derived(items.filter(i => showConstruction && i.titleFailed).length);
	let tvdbMatchCount = $derived(items.filter(i => i.tvdbMatch?.matched).length);
	let tvdbNoMatchCount = $derived(items.filter(i => !i.titleFailed && i.tvdbMatch && !i.tvdbMatch.matched).length);

	// Coverage statistics
	let claimedHigherCount = $derived(items.filter(i => getCoverageStatus(i.id) === 'claimed-higher').length);
	let claimedSameCount = $derived(items.filter(i => getCoverageStatus(i.id) === 'claimed-same').length);

	/**
	 * Gap = item where the current ruleset's pipeline doesn't fully succeed
	 * (title construction failed OR TVDB match failed) AND no other ruleset covers it.
	 */
	let gapCount = $derived.by(() => {
		if (!hasOtherRulesets) return 0;
		return items.filter(i => {
			// Item must be failing in the current ruleset's pipeline
			const currentFails = i.titleFailed || (i.tvdbMatch && !i.tvdbMatch.matched);
			if (!currentFails) return false;
			// AND no other ruleset covers it
			return getCoverageStatus(i.id) === null;
		}).length;
	});

	function formatDate(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function formatDuration(seconds: number): string {
		const totalMinutes = Math.round(seconds / 60);
		return `${totalMinutes} min`;
	}

	function isGapItem(item: ItemWithConstruction): boolean {
		if (!hasOtherRulesets) return false;
		const currentFails = item.titleFailed || (item.tvdbMatch && !item.tvdbMatch.matched);
		return !!currentFails && getCoverageStatus(item.id) === null;
	}

	function getCoverageRowClass(itemId: string): string {
		const status = getCoverageStatus(itemId);
		switch (status) {
			case 'claimed-higher': return 'coverage-claimed-higher';
			case 'claimed-same': return 'coverage-claimed-same';
			default: return '';
		}
	}

	function getCoverageBadgeText(itemId: string): string | null {
		const matches = getCoverageMatches(itemId);
		if (matches.length === 0) return null;
		// Don't show R#-1 for new/unsaved rulesets
		if (matches[0].rulesetId === NEW_RULESET_SENTINEL_ID) return null;
		return `R#${matches[0].rulesetId}`;
	}

	function closeDrawer() {
		showDrawer = false;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			closeDrawer();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showDrawer) {
			closeDrawer();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="live-preview-panel h-full flex flex-col">
	<!-- Header with pipeline badges -->
	<div class="mb-4">
		<div class="flex items-center gap-2 mb-2">
			<h3 class="font-semibold text-lg">Live-Vorschau</h3>
			{#if isLoading || isEvaluating}
				<Spinner size="sm" />
			{/if}
			<!-- Drawer toggle button -->
			{#if hasAnyRulesets}
				<button
					type="button"
					class="btn btn-sm ml-auto"
					onclick={() => showDrawer = !showDrawer}
					title="Ruleset-Abdeckung & Priorität simulieren"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
					</svg>
					Abdeckung & Priorität
				</button>
			{/if}
		</div>

		{#if rawItems.length > 0}
			<div class="flex flex-wrap items-center gap-1.5 text-xs">
				<Badge variant="accent" size="sm">
					{displayItems.length}{hasMoreResults ? '+' : ''} Ergebnisse
				</Badge>
				{#if userFilteredCount > 0}
					<Badge variant="warning" size="sm">
						-{userFilteredCount} Filter
					</Badge>
				{/if}
				{#if autoFilteredCount > 0}
					<Badge size="sm">
						-{autoFilteredCount} AD/GS
					</Badge>
				{/if}
				{#if showConstruction}
					{#if successCount > 0}
						<Badge variant="success" size="sm">
							{successCount} konstruiert
						</Badge>
					{/if}
					{#if failureCount > 0}
						<Badge variant="error" size="sm">
							{failureCount} fehlgeschlagen
						</Badge>
					{/if}
				{/if}
				{#if showTvdbMatch}
					{#if tvdbMatchCount > 0}
						<Badge variant="info" size="sm">
							{tvdbMatchCount} TVDB
						</Badge>
					{/if}
					{#if tvdbNoMatchCount > 0}
						<Badge variant="warning" size="sm">
							{tvdbNoMatchCount} kein Match
						</Badge>
					{/if}
				{/if}
				{#if hasOtherRulesets}
					{#if claimedHigherCount > 0}
						<Badge size="sm">
							{claimedHigherCount} abgedeckt
						</Badge>
					{/if}
					{#if claimedSameCount > 0}
						<Badge variant="warning" size="sm">
							{claimedSameCount} Konflikt
						</Badge>
					{/if}
					{#if gapCount > 0}
						<Badge variant="error" size="sm">
							{gapCount} Lücken
						</Badge>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Search + toggle bar -->
	{#if rawItems.length > 0}
		<div class="mb-3 flex gap-2 items-center">
			<input
				type="text"
				class="input input-sm flex-1"
				placeholder="Suche in Sender, Topic, Titel, Datum..."
				bind:value={searchQuery}
			/>
			{#if hasOtherRulesets}
				<button
					type="button"
					class="btn btn-sm shrink-0"
					class:btn-primary={hideClaimed}
					onclick={() => hideClaimed = !hideClaimed}
				>
					{#if hideClaimed}
						<!-- Eye-off icon -->
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
							<path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
						</svg>
						<span class="hidden sm:inline">Ausgeblendet ({hiddenClaimedCount})</span>
					{:else}
						<!-- Eye icon -->
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
							<path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
							<path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
						</svg>
						<span class="hidden sm:inline">Abgedeckte ausblenden</span>
					{/if}
				</button>
				<Tooltip text="Blendet Einträge aus, die bereits von einem Ruleset mit höherer Priorität (niedrigere Nummer) abgedeckt werden." position="bottom" />
			{/if}
		</div>
	{/if}

	<!-- Content area -->
	<div class="flex-1 overflow-y-auto min-h-0">
		{#if error}
			<div class="alert alert-warning">
				<span>{error}</span>
			</div>
		{:else if displayItems.length > 0}
			<div class="overflow-x-auto">
				<table class="data-table" style="table-layout: fixed; width: 100%;">
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
					<thead>
						<tr>
							<th class="resize-th">
								Sender
								<button type="button" class="resize-handle" aria-label="Spalte vergrößern/verkleinern" onmousedown={(e) => startResize(e, 'sender')}></button>
							</th>
							<th class="resize-th">
								Topic
								<button type="button" class="resize-handle" aria-label="Spalte vergrößern/verkleinern" onmousedown={(e) => startResize(e, 'topic')}></button>
							</th>
							<th class="resize-th">
								Titel
								<button type="button" class="resize-handle" aria-label="Spalte vergrößern/verkleinern" onmousedown={(e) => startResize(e, 'title')}></button>
							</th>
							{#if showConstruction}
								<th class="resize-th">
									Konstruiert
									<button type="button" class="resize-handle" aria-label="Spalte vergrößern/verkleinern" onmousedown={(e) => startResize(e, 'constructed')}></button>
								</th>
							{/if}
							{#if showSeasonEpisode}
								<th class="resize-th">
									S/E
									<button type="button" class="resize-handle" aria-label="Spalte vergrößern/verkleinern" onmousedown={(e) => startResize(e, 'seasonEpisode')}></button>
								</th>
							{/if}
							{#if showTvdbMatch}
								<th class="resize-th">
									TVDB Episode
									<button type="button" class="resize-handle" aria-label="Spalte vergrößern/verkleinern" onmousedown={(e) => startResize(e, 'tvdbEpisode')}></button>
								</th>
							{/if}
							<th class="resize-th">
								Datum
								<button type="button" class="resize-handle" aria-label="Spalte vergrößern/verkleinern" onmousedown={(e) => startResize(e, 'date')}></button>
							</th>
							<th>Dauer</th>
						</tr>
					</thead>
					<tbody>
						{#each displayItems as item}
							{@const coverageStatus = getCoverageStatus(item.id)}
							{@const gap = isGapItem(item)}
							<tr
								class:opacity-40={showConstruction && item.titleFailed}
								class:coverage-gap={gap}
								class={getCoverageRowClass(item.id)}
							>
								<td class="truncate overflow-hidden">
									<span class="badge badge-sm">{item.channel}</span>
								</td>
								<td class="truncate overflow-hidden" title={item.topic}>{item.topic}</td>
								<td class="truncate overflow-hidden" title={item.title}>
									{#if showConstruction && item.titleFailed}
										<span class="line-through text-error">{item.title}</span>
									{:else}
										{item.title}
									{/if}
								</td>
								{#if showConstruction}
									<td class="overflow-hidden font-mono text-xs">
										{#if item.constructedTitle}
											<span class="flex items-center gap-1 text-success" title={item.constructedTitle}>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
													<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
												</svg>
												<span class="truncate">{item.constructedTitle}</span>
											</span>
										{:else if item.titleFailed}
											<span class="flex items-center gap-1 text-error" title={item.failedStep?.error || 'Fehler'}>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
													<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
												</svg>
												<span class="truncate text-xs">{item.failedStep?.error || 'Fehler'}</span>
											</span>
										{:else}
											<span class="text-text-tertiary">-</span>
										{/if}
									</td>
								{/if}
								{#if showSeasonEpisode}
									<td class="overflow-hidden">
										{#if item.extractedSeason !== null || item.extractedEpisode !== null}
											<span class="font-mono text-success text-xs">
												{#if item.extractedSeason !== null}S{item.extractedSeason.padStart(2, '0')}{/if}{#if item.extractedEpisode !== null}E{item.extractedEpisode.padStart(2, '0')}{/if}
											</span>
										{:else if item.titleFailed}
											<span class="text-text-tertiary">-</span>
										{:else}
											<span class="text-error text-xs">Fehler</span>
										{/if}
									</td>
								{/if}
								{#if showTvdbMatch}
									<td class="overflow-hidden text-xs">
										{#if item.tvdbMatch?.matched && item.tvdbMatch.episode}
											<span class="flex items-center gap-1 text-success" title={`S${item.tvdbMatch.episode.seasonNumber}E${item.tvdbMatch.episode.episodeNumber}: ${item.tvdbMatch.episode.name}`}>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
													<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
												</svg>
												<span class="truncate">{item.tvdbMatch.episode.name}</span>
											</span>
										{:else if item.titleFailed}
											<span class="text-text-tertiary">-</span>
										{:else if item.tvdbMatch && !item.tvdbMatch.matched}
											<span class="flex items-center gap-1 text-warning" title={item.tvdbMatch.error || 'Keine Episode gefunden'}>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
													<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
												</svg>
												<span class="truncate">Kein Match</span>
											</span>
										{:else}
											<span class="text-text-tertiary">-</span>
										{/if}
									</td>
								{/if}
								<td class="whitespace-nowrap">
									{formatDate(item.timestamp)}
									{#if coverageStatus}
										{@const badgeText = getCoverageBadgeText(item.id)}
										{#if badgeText}
											<span
												class="badge badge-sm ml-1"
												class:badge-warning={coverageStatus === 'claimed-same'}
												title={coverageStatus === 'claimed-higher' ? 'Abgedeckt durch höherpriores Ruleset' : coverageStatus === 'claimed-same' ? 'Gleiche Priorität — Konflikt' : 'Niedrigere Priorität'}
											>
												{badgeText}
											</span>
										{/if}
									{/if}
								</td>
								<td class="whitespace-nowrap">{formatDuration(item.duration)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if isLoading}
			<div class="flex justify-center items-center py-12">
				<Spinner size="lg" />
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-12 text-text-tertiary">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<p class="font-medium">Keine Vorschau-Daten</p>
				<p class="text-sm mt-1">Gib Topics in Schritt 1 ein</p>
			</div>
		{/if}
	</div>

	<!-- Footer -->
	{#if (autoFilteredCount > 0 || userFilteredCount > 0) && rawItems.length > 0}
		<div class="mt-3 text-xs text-text-tertiary space-y-0.5">
			{#if userFilteredCount > 0}
				<div>{userFilteredCount} durch deine Filter entfernt</div>
			{/if}
			{#if autoFilteredCount > 0}
				<div>{autoFilteredCount} Audiodeskription/Gebärdensprache ausgeblendet</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Drawer overlay -->
{#if showDrawer}
	<div class="coverage-drawer-backdrop" onclick={handleBackdropClick} role="presentation">
		<div class="coverage-drawer" role="dialog" aria-label="Ruleset-Abdeckung">
			<div class="flex items-center justify-between p-4 border-b border-border-strong">
				<h3 class="font-semibold">Ruleset-Abdeckung</h3>
				<button
					type="button"
					class="btn btn-ghost btn-icon btn-sm"
					onclick={closeDrawer}
					aria-label="Schließen"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto p-4">
				<CoverageSimulator {currentRulesetId} />
			</div>
		</div>
	</div>
{/if}

<style>
	.resize-th {
		position: relative;
		padding-right: 12px;
	}

	.resize-handle {
		all: unset;
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

	.resize-handle::after {
		content: '';
		width: 2px;
		height: 16px;
		background: var(--color-text-tertiary);
		opacity: 0.3;
		border-radius: 1px;
		transition: all 0.15s ease;
	}

	.resize-handle:hover::after {
		opacity: 0.6;
		height: 20px;
	}

	.resize-handle:active::after {
		background: var(--color-accent);
		height: 100%;
	}

</style>
