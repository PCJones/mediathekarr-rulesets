<script lang="ts">
	import { getContext } from 'svelte';
	import { rulesetStore, wizardStore, isRulesetValid } from '$stores/ruleset';
	import { queryByTopic } from '$api/mediathekview';
	import { exportRulesetAsJson } from '$api/rulesets';
	import {
		evaluateFilters,
		buildTitleFromRules,
		extractSeasonEpisode,
		checkSkipKeywords
	} from '$utils/regex';
	import { matchEpisodeByStrategy } from '$utils/tvdbMatcher';
	import type { MediathekItem, MediathekItemWithEvaluation, ItemEvaluation, Ruleset, Media, DurationInfo, TvdbShowData, TvdbEpisode } from '$types';

	// Get callbacks from context (set by WizardBuilder)
	const wizardCallbacks = getContext<{
		onSave: (data: Omit<Ruleset, 'id'>) => Promise<void>;
		onCancel: () => void;
		media: Media;
		durationInfo: DurationInfo | null;
		tvdbShowData: TvdbShowData | null;
	}>('wizardCallbacks');

	// Get TVDB episodes from context
	let tvdbEpisodes = $derived(wizardCallbacks?.tvdbShowData?.episodes || []);

	// Get current ruleset from store
	let ruleset = $derived($rulesetStore);
	let isEditing = $derived($wizardStore.isEditing);
	let editingId = $derived($wizardStore.editingId);
	let canSave = $derived($isRulesetValid);

	// Local state
	let isLoading = $state(false);
	let isSaving = $state(false);
	let error = $state<string | null>(null);
	let testResults = $state<MediathekItemWithEvaluation[]>([]);
	let saveSuccess = $state(false);

	// Stats
	let stats = $derived({
		total: testResults.length,
		matched: testResults.filter(r => r.evaluation.status === 'matched').length,
		failed: testResults.filter(r => r.evaluation.status === 'failed').length,
		skipped: testResults.filter(r => r.evaluation.status === 'skipped').length
	});

	// Run test
	async function runTest() {
		if (!ruleset.topic) {
			error = 'Kein Topic definiert';
			return;
		}

		isLoading = true;
		error = null;
		testResults = [];

		try {
			// Fetch items from MediathekViewWeb
			const items = await queryByTopic(ruleset.topic, { size: 50 });

			// Evaluate each item
			testResults = items.map(item => ({
				...item,
				evaluation: evaluateItem(item)
			}));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Testen';
		} finally {
			isLoading = false;
		}
	}

	// Evaluate a single item against the ruleset
	function evaluateItem(item: MediathekItem): ItemEvaluation & { tvdbEpisode?: TvdbEpisode | null } {
		// Check for skip keywords first
		const skipKeyword = checkSkipKeywords(item.title);
		if (skipKeyword) {
			return {
				status: 'skipped',
				filterChecks: [],
				titleConstruction: [],
				constructedTitle: null,
				skipReason: `Enthält "${skipKeyword}"`
			};
		}

		// Run filters
		const filterChecks = evaluateFilters(item, ruleset.filters);
		const allFiltersPassed = filterChecks.every(f => f.passed);

		if (!allFiltersPassed) {
			return {
				status: 'failed',
				filterChecks,
				titleConstruction: [],
				constructedTitle: null
			};
		}

		// Build title from rules
		const { steps, finalTitle } = buildTitleFromRules(item, ruleset.titleRegexRules);

		if (finalTitle === null && ruleset.titleRegexRules.length > 0) {
			return {
				status: 'failed',
				filterChecks,
				titleConstruction: steps,
				constructedTitle: null
			};
		}

		// Extract season/episode if needed
		let seasonEpisodeExtraction = undefined;
		if (ruleset.seasonRegex || ruleset.episodeRegex) {
			seasonEpisodeExtraction = extractSeasonEpisode(
				finalTitle || item.title,
				ruleset.seasonRegex,
				ruleset.episodeRegex
			);
		}

		// Match against TVDB if episodes available
		let tvdbEpisode: TvdbEpisode | null = null;
		let tvdbMatched = false;
		if (tvdbEpisodes.length > 0) {
			const tvdbResult = matchEpisodeByStrategy(
				item,
				tvdbEpisodes,
				ruleset.matchingStrategy,
				ruleset.titleRegexRules,
				ruleset.seasonRegex,
				ruleset.episodeRegex
			);
			tvdbEpisode = tvdbResult.episode;
			tvdbMatched = tvdbResult.matched;
		}

		return {
			status: tvdbEpisodes.length > 0 ? (tvdbMatched ? 'matched' : 'failed') : 'matched',
			filterChecks,
			titleConstruction: steps,
			constructedTitle: finalTitle || item.title,
			seasonEpisodeExtraction,
			tvdbEpisode
		};
	}

	// Save ruleset via callback
	async function handleSave() {
		if (!canSave || !wizardCallbacks?.onSave) return;

		isSaving = true;
		error = null;

		try {
			await wizardCallbacks.onSave(ruleset);
			saveSuccess = true;
			// Navigation is handled by parent component
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Speichern';
		} finally {
			isSaving = false;
		}
	}

	// Export as JSON
	function handleExport() {
		const json = exportRulesetAsJson(ruleset as any);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ruleset-${ruleset.topic.replace(/[|/\\]/g, '_')}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Result item expansion state
	let expandedItems = $state<Set<string>>(new Set());

	function toggleExpand(id: string) {
		if (expandedItems.has(id)) {
			expandedItems.delete(id);
		} else {
			expandedItems.add(id);
		}
		expandedItems = new Set(expandedItems);
	}
</script>

<div class="test-and-save">
	<h2 class="text-2xl font-bold mb-2">Testen & Speichern</h2>
	<p class="text-base-content/70 mb-6">
		Teste dein Ruleset gegen echte Mediathek-Daten und speichere es, wenn alles funktioniert.
	</p>

	{#if saveSuccess}
		<div class="alert alert-success mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>Ruleset erfolgreich gespeichert! Weiterleitung...</span>
		</div>
	{/if}

	{#if error}
		<div class="alert alert-error mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	<!-- Action buttons -->
	<div class="flex flex-wrap gap-3 mb-6">
		<button
			class="btn btn-primary"
			onclick={runTest}
			disabled={isLoading || !ruleset.topic}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
				</svg>
			{/if}
			Test starten
		</button>

		<button
			class="btn btn-success"
			onclick={handleSave}
			disabled={isSaving || !canSave}
		>
			{#if isSaving}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
					<path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
				</svg>
			{/if}
			{isEditing ? 'Aktualisieren' : 'Speichern'}
		</button>

		<button class="btn btn-outline" onclick={handleExport}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
			</svg>
			Als JSON exportieren
		</button>
	</div>

	<!-- Test results -->
	{#if testResults.length > 0}
		<!-- Stats -->
		<div class="stats shadow mb-6 w-full">
			<div class="stat">
				<div class="stat-title">Gesamt</div>
				<div class="stat-value">{stats.total}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Matched</div>
				<div class="stat-value text-success">{stats.matched}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Fehlgeschlagen</div>
				<div class="stat-value text-error">{stats.failed}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Übersprungen</div>
				<div class="stat-value text-warning">{stats.skipped}</div>
			</div>
		</div>

		<!-- Results list -->
		<div class="space-y-3 max-h-[500px] overflow-y-auto">
			{#each testResults as result}
				{@const isExpanded = expandedItems.has(result.id)}
				<div
					class="card bg-base-100 result-item"
					class:status-matched={result.evaluation.status === 'matched'}
					class:status-failed={result.evaluation.status === 'failed'}
					class:status-skipped={result.evaluation.status === 'skipped'}
				>
					<div class="card-body py-3">
						<!-- Header -->
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									{#if result.evaluation.status === 'matched'}
										<span class="badge badge-success badge-sm">MATCHED</span>
									{:else if result.evaluation.status === 'failed'}
										<span class="badge badge-error badge-sm">FAILED</span>
									{:else}
										<span class="badge badge-warning badge-sm">SKIPPED</span>
									{/if}
									<h3 class="font-medium truncate">{result.title}</h3>
								</div>
								<p class="text-sm text-base-content/60 mt-1">
									{result.channel} · {result.topic} · {Math.round(result.duration / 60)} min
									{#if result.evaluation.tvdbEpisode}
										<span class="text-success"> → S{result.evaluation.tvdbEpisode.seasonNumber}E{result.evaluation.tvdbEpisode.episodeNumber}</span>
									{/if}
								</p>
							</div>
							<button
								class="btn btn-ghost btn-sm"
								onclick={() => toggleExpand(result.id)}
							>
								{isExpanded ? '▲' : '▼'}
							</button>
						</div>

						<!-- Expanded details -->
						{#if isExpanded}
							<div class="mt-4 space-y-3 text-sm debug-expand">
								{#if result.evaluation.skipReason}
									<div class="p-2 bg-warning/10 rounded">
										<span class="font-medium">Übersprungen:</span> {result.evaluation.skipReason}
									</div>
								{/if}

								{#if result.evaluation.filterChecks.length > 0}
									<div>
										<p class="font-medium mb-1">Filter-Prüfungen:</p>
										{#each result.evaluation.filterChecks as check}
											<div class="flex items-center gap-2 ml-2">
												<span class:text-success={check.passed} class:text-error={!check.passed}>
													{check.passed ? '✓' : '✗'}
												</span>
												<span>{check.explanation}</span>
											</div>
										{/each}
									</div>
								{/if}

								{#if result.evaluation.titleConstruction.length > 0}
									<div>
										<p class="font-medium mb-1">Titel-Konstruktion:</p>
										{#each result.evaluation.titleConstruction as step}
											<div class="flex items-center gap-2 ml-2">
												<span class:text-success={step.success} class:text-error={!step.success}>
													{step.success ? '✓' : '✗'}
												</span>
												<span>
													{step.ruleType === 'static' ? 'Statisch' : 'Regex'}:
													{step.result !== null ? `"${step.result}"` : step.error}
												</span>
											</div>
										{/each}
										{#if result.evaluation.constructedTitle}
											<p class="ml-2 mt-1">
												<span class="font-medium">Ergebnis:</span>
												<code class="bg-base-200 px-1 rounded">"{result.evaluation.constructedTitle}"</code>
											</p>
										{/if}
									</div>
								{/if}

								{#if result.evaluation.seasonEpisodeExtraction}
									{@const se = result.evaluation.seasonEpisodeExtraction}
									<div>
										<p class="font-medium mb-1">Season/Episode:</p>
										<div class="ml-2">
											{#if se.seasonValue}
												<p>Season: {se.isSeasonStatic ? '(statisch)' : ''} {se.seasonValue}</p>
											{/if}
											{#if se.episodeValue}
												<p>Episode: {se.isEpisodeStatic ? '(statisch)' : ''} {se.episodeValue}</p>
											{/if}
										</div>
									</div>
								{/if}

								{#if tvdbEpisodes.length > 0}
									<div>
										<p class="font-medium mb-1">TVDB Episode:</p>
										<div class="ml-2">
											{#if result.evaluation.tvdbEpisode}
												<p class="text-success">
													S{result.evaluation.tvdbEpisode.seasonNumber}E{result.evaluation.tvdbEpisode.episodeNumber}: {result.evaluation.tvdbEpisode.name}
												</p>
											{:else}
												<p class="text-warning">Keine passende Episode gefunden</p>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else if !isLoading}
		<div class="text-center py-12 text-base-content/50">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
			</svg>
			<p>Klicke auf "Test starten", um dein Ruleset gegen echte Daten zu testen.</p>
		</div>
	{/if}

	<!-- Ruleset summary -->
	<div class="collapse collapse-arrow bg-base-100 mt-6">
		<input type="checkbox" checked />
		<div class="collapse-title font-medium">
			Ruleset-Zusammenfassung
		</div>
		<div class="collapse-content">
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
				<div>
					<span class="text-base-content/60">Topic:</span>
					<p class="font-mono">{ruleset.topic || '-'}</p>
				</div>
				<div>
					<span class="text-base-content/60">TVDB ID:</span>
					<p>{ruleset.tvdbId || '-'}</p>
				</div>
				<div>
					<span class="text-base-content/60">Priorität:</span>
					<p>{ruleset.priority}</p>
				</div>
				<div>
					<span class="text-base-content/60">Strategie:</span>
					<p>{ruleset.matchingStrategy}</p>
				</div>
				<div>
					<span class="text-base-content/60">Filter:</span>
					<p>{ruleset.filters.length}</p>
				</div>
				<div>
					<span class="text-base-content/60">Titel-Regeln:</span>
					<p>{ruleset.titleRegexRules.length}</p>
				</div>
			</div>
		</div>
	</div>
</div>
