<script lang="ts">
	import { page } from '$app/stores';
	import { getMedia } from '$api/media';
	import { getRulesetsForMedia, createRuleset, updateRuleset, deleteRuleset } from '$api/rulesets';
	import { getShowData, calculateDurationInfo } from '$api/tvdb';
	import type { Media, Ruleset, DurationInfo, TvdbShowData } from '$types';
	import WizardBuilder from '$components/wizard/WizardBuilder.svelte';
	import RulesetTile from '$components/rulesets/RulesetTile.svelte';
	import Button from '$components/ui/Button.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	let mediaId = $derived(Number($page.params.mediaId));

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let media = $state<Media | null>(null);
	let rulesets = $state<Ruleset[]>([]);
	let durationInfo = $state<DurationInfo | null>(null);
	let tvdbShowData = $state<TvdbShowData | null>(null);

	let showWizard = $state(false);
	let editingRuleset = $state<Ruleset | null>(null);

	$effect(() => {
		const id = mediaId;
		loadData(id);
	});

	async function loadData(id: number) {
		isLoading = true;
		error = null;
		showWizard = false;
		editingRuleset = null;
		durationInfo = null;
		tvdbShowData = null;

		try {
			media = await getMedia(id);
			rulesets = await getRulesetsForMedia(id);

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

			rulesets = await getRulesetsForMedia(mediaId);
			showWizard = false;
			editingRuleset = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Speichern';
			throw e;
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

<div class="space-y-6">
	<!-- Header -->
	<div>
		<a href="/media" class="btn btn-ghost btn-sm mb-3">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
			</svg>
			Zurück zu Media
		</a>

		{#if media}
			<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<h1 class="text-2xl font-bold">{media.name}</h1>
					<div class="flex flex-wrap gap-1.5 mt-2">
						<Badge variant={media.type === 'show' ? 'accent' : 'info'}>
							{media.type === 'show' ? 'Serie' : 'Film'}
						</Badge>
						{#if media.tvdbId}
							<Badge>TVDB: {media.tvdbId}</Badge>
						{/if}
						{#if durationInfo}
							<Badge size="sm">Ø {durationInfo.averageRuntime} min</Badge>
						{/if}
					</div>
				</div>

				{#if rulesets.length > 0 && !showWizard}
					<Button variant="primary" onclick={startAddNew}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
						</svg>
						Neues Ruleset
					</Button>
				{/if}
			</div>
		{/if}
	</div>

	{#if isLoading}
		<div class="flex justify-center py-12">
			<Spinner size="lg" />
		</div>
	{:else if error}
		<Alert variant="error">{error}</Alert>
	{/if}

	{#if !isLoading && media}
		{#if showWizard}
			<div>
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-semibold">
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
			<div>
				<h2 class="text-xl font-semibold mb-4">
					Rulesets ({rulesets.length})
				</h2>

				{#if rulesets.length === 0}
					<div class="text-center py-8 bg-surface rounded-lg border border-border">
						<p class="text-text-secondary mb-2">Keine Rulesets vorhanden</p>
						<p class="text-sm text-text-tertiary">Das erste Ruleset wird automatisch erstellt</p>
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
