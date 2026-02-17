<script lang="ts">
	import { page } from '$app/stores';
	import { getMedia } from '$api/media';
	import { getRulesetsForMedia, createRuleset, updateRuleset, deleteRuleset } from '$api/rulesets';
	import { getShowData, calculateDurationInfo } from '$api/tvdb';
	import type { Media, Ruleset, DurationInfo, TvdbShowData } from '$types';
	import WizardBuilder from '$components/builder/WizardBuilder.svelte';
	import RulesetTile from '$components/builder/RulesetTile.svelte';

	// Get mediaId from route
	let mediaId = $derived(Number($page.params.mediaId));

	// State
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let media = $state<Media | null>(null);
	let rulesets = $state<Ruleset[]>([]);
	let durationInfo = $state<DurationInfo | null>(null);
	let tvdbShowData = $state<TvdbShowData | null>(null);

	// Wizard state
	let showWizard = $state(false);
	let editingRuleset = $state<Ruleset | null>(null);

	// Load data when mediaId changes (handles both initial mount and navigation)
	$effect(() => {
		const id = mediaId; // Track mediaId
		loadData(id);
	});

	async function loadData(id: number) {
		isLoading = true;
		error = null;
		// Reset wizard state when loading new media
		showWizard = false;
		editingRuleset = null;
		durationInfo = null;
		tvdbShowData = null;

		try {
			// Load media info
			media = await getMedia(id);

			// Load rulesets for this media
			rulesets = await getRulesetsForMedia(id);

			// Load TVDB show data if TVDB ID exists
			if (media.tvdbId) {
				try {
					const showDataResponse = await getShowData(media.tvdbId);
					if (showDataResponse?.episodes) {
						tvdbShowData = showDataResponse;
						durationInfo = calculateDurationInfo(showDataResponse.episodes);
					}
				} catch {
					// TVDB data is optional
				}
			}

			// Auto-show wizard if no rulesets exist
			if (rulesets.length === 0) {
				showWizard = true;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden';
		} finally {
			isLoading = false;
		}
	}

	function startAddNew() {
		editingRuleset = null;
		showWizard = true;
	}

	function startEdit(ruleset: Ruleset) {
		editingRuleset = ruleset;
		showWizard = true;
	}

	// Can only cancel wizard if rulesets already exist
	let canCancelWizard = $derived(rulesets.length > 0);

	function cancelWizard() {
		if (!canCancelWizard) return;
		showWizard = false;
		editingRuleset = null;
	}

	async function handleSave(rulesetData: Omit<Ruleset, 'id'>) {
		error = null;

		try {
			if (editingRuleset?.id) {
				await updateRuleset(editingRuleset.id, rulesetData);
			} else {
				await createRuleset({ ...rulesetData, mediaId });
			}

			// Reload rulesets
			rulesets = await getRulesetsForMedia(mediaId);
			showWizard = false;
			editingRuleset = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Speichern';
			throw e; // Re-throw so TestAndSave can show the error
		}
	}

	async function handleDelete(ruleset: Ruleset) {
		if (!confirm(`Ruleset "${ruleset.topic}" wirklich löschen?`)) return;

		try {
			await deleteRuleset(ruleset.id!);
			rulesets = await getRulesetsForMedia(mediaId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Löschen';
		}
	}

	async function handleDuplicate(ruleset: Ruleset) {
		try {
			// Clone ruleset with incremented priority
			const maxPriority = Math.max(...rulesets.map(r => r.priority), 0);
			const cloned = {
				...ruleset,
				id: undefined,
				priority: maxPriority + 1
			};
			await createRuleset(cloned as Omit<Ruleset, 'id'>);
			rulesets = await getRulesetsForMedia(mediaId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Duplizieren';
		}
	}
</script>

<svelte:head>
	<title>{media?.name || 'Rulesets'} - MediathekArr</title>
</svelte:head>

<div class="rulesets-page">
	<!-- Header -->
	<div class="mb-6">
		<a href="/media" class="btn btn-ghost btn-sm mb-2">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
			</svg>
			Zurück zu Media
		</a>

		{#if media}
			<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<h1 class="text-3xl font-bold">{media.name}</h1>
					<div class="flex flex-wrap gap-2 mt-2">
						<span class="badge" class:badge-primary={media.type === 'show'} class:badge-secondary={media.type === 'movie'}>
							{media.type === 'show' ? 'Serie' : 'Film'}
						</span>
						{#if media.tvdbId}
							<span class="badge badge-outline">TVDB: {media.tvdbId}</span>
						{/if}
						{#if durationInfo}
							<span class="badge badge-ghost">⌀ {durationInfo.averageRuntime} min</span>
						{/if}
					</div>
				</div>

				{#if rulesets.length > 0 && !showWizard}
					<button class="btn btn-primary" onclick={startAddNew}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
						</svg>
						Neues Ruleset
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if isLoading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	{#if !isLoading && media}
		{#if showWizard}
			<!-- Wizard takes full width -->
			<div class="wizard-panel">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-bold">
						{editingRuleset ? 'Ruleset bearbeiten' : 'Neues Ruleset erstellen'}
					</h2>
				</div>

				<WizardBuilder
					{media}
					existingRuleset={editingRuleset ?? undefined}
					{durationInfo}
					{tvdbShowData}
					onSave={handleSave}
					onCancel={cancelWizard}
					canCancel={canCancelWizard}
				/>
			</div>
		{:else}
			<!-- Rulesets grid -->
			<div>
				<h2 class="text-xl font-bold mb-4">
					Rulesets ({rulesets.length})
				</h2>

				{#if rulesets.length === 0}
					<div class="text-center py-8 bg-base-200 rounded-lg">
						<p class="text-base-content/60 mb-2">Keine Rulesets vorhanden</p>
						<p class="text-sm text-base-content/50">Das erste Ruleset wird automatisch erstellt</p>
					</div>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each rulesets.sort((a, b) => a.priority - b.priority) as ruleset}
							<RulesetTile
								{ruleset}
								isSelected={editingRuleset?.id === ruleset.id}
								onEdit={() => startEdit(ruleset)}
								onDelete={() => handleDelete(ruleset)}
								onDuplicate={() => handleDuplicate(ruleset)}
							/>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- No max-width restriction - let the layout container handle width -->
