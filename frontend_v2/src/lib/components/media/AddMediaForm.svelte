<script lang="ts">
	import { createMedia } from '$api/media';
	import { searchShow, type SearchResult } from '$api/search';
	import { getShowData, calculateDurationInfo, detectShowType } from '$api/tvdb';
	import type { DurationInfo, TvdbShowData } from '$types';
	import Card from '$components/ui/Card.svelte';
	import Input from '$components/ui/Input.svelte';
	import Button from '$components/ui/Button.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	interface PickedMedia {
		name: string;
		type: 'show' | 'movie';
		tvdbId?: number;
		tmdbId?: number;
		imdbId?: string;
	}

	interface Props {
		onCreated: () => void;
		onCancel: () => void;
		/** Replaces the direct `createMedia` call (users propose instead). */
		onPick?: (media: PickedMedia) => void | Promise<void>;
		submitLabel?: string;
		title?: string;
	}

	let {
		onCreated,
		onCancel,
		onPick,
		submitLabel = 'Hinzufügen',
		title = 'Neue Serie'
	}: Props = $props();

	// Search state
	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchResults = $state<SearchResult[]>([]);
	let showDropdown = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Form state
	let isSaving = $state(false);
	let formError = $state<string | null>(null);
	let newMedia = $state({
		name: '',
		type: 'show' as 'show' | 'movie',
		tvdbId: '' as string | number,
		tmdbId: '' as string | number,
		imdbId: ''
	});

	// Show analysis state
	let selectedSearchResult = $state<SearchResult | null>(null);
	let showAnalysis = $state<{
		showData: TvdbShowData | null;
		durationInfo: DurationInfo | null;
		showType: { type: string; reasoning: string } | null;
		isLoading: boolean;
	}>({
		showData: null,
		durationInfo: null,
		showType: null,
		isLoading: false
	});

	function handleSearchInput(event: Event) {
		const query = (event.target as HTMLInputElement).value;
		searchQuery = query;

		if (searchTimeout) clearTimeout(searchTimeout);

		if (query.length < 2) {
			searchResults = [];
			showDropdown = false;
			return;
		}

		searchTimeout = setTimeout(() => performSearch(query), 300);
	}

	async function performSearch(query: string) {
		isSearching = true;
		try {
			searchResults = await searchShow(query);
			showDropdown = true;
		} catch {
			// Silently fail
		} finally {
			isSearching = false;
		}
	}

	async function selectResult(result: SearchResult) {
		newMedia = {
			name: result.germanTitle,
			type: 'show',
			tvdbId: result.tvdbId,
			tmdbId: '',
			imdbId: ''
		};
		selectedSearchResult = result;
		showDropdown = false;
		searchResults = [];
		searchQuery = '';

		showAnalysis = { showData: null, durationInfo: null, showType: null, isLoading: true };
		try {
			const showData = await getShowData(result.tvdbId);
			if (showData?.episodes) {
				const durationInfo = calculateDurationInfo(showData.episodes);
				const showType = detectShowType(showData.episodes);
				showAnalysis = { showData, durationInfo, showType, isLoading: false };
			} else {
				showAnalysis = { showData, durationInfo: null, showType: null, isLoading: false };
			}
		} catch {
			showAnalysis = { showData: null, durationInfo: null, showType: null, isLoading: false };
		}
	}

	const positiveId = (value: string | number) => (Number(value) > 0 ? Number(value) : null);
	let tvdbId = $derived(positiveId(newMedia.tvdbId));
	let tmdbId = $derived(positiveId(newMedia.tmdbId));
	let imdbId = $derived(newMedia.imdbId.trim() || null);
	let isShow = $derived(newMedia.type === 'show');
	let idsComplete = $derived(isShow ? tvdbId !== null : tmdbId !== null && imdbId !== null);

	async function handleCreateMedia() {
		if (!newMedia.name.trim() || !idsComplete) return;

		isSaving = true;
		formError = null;

		const picked: PickedMedia = {
			name: newMedia.name.trim(),
			type: newMedia.type,
			tvdbId: tvdbId ?? undefined,
			tmdbId: tmdbId ?? undefined,
			imdbId: imdbId ?? undefined
		};

		try {
			if (onPick) {
				await onPick(picked);
				return;
			}
			await createMedia(picked);
			onCreated();
		} catch (e) {
			formError = e instanceof Error ? e.message : 'Fehler beim Erstellen';
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="border border-border rounded-lg bg-surface sticky top-20 self-start">
	<div class="p-4 border-b border-border">
		<h2 class="text-lg font-semibold">{title}</h2>
	</div>

	<!-- TVDB Search -->
	<div class="p-4 border-b border-border">
		<div class="relative">
			<input
				type="text"
				value={searchQuery}
				oninput={handleSearchInput}
				placeholder="TVDB-Suche..."
				class="input pl-9"
			/>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			{#if isSearching}
				<div class="absolute right-3 top-1/2 -translate-y-1/2">
					<Spinner size="sm" />
				</div>
			{/if}

			{#if showDropdown && searchResults.length > 0}
				<div class="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md z-50 max-h-64 overflow-y-auto">
					{#each searchResults as result}
						<button
							type="button"
							class="w-full p-3 hover:bg-surface-raised text-left border-b border-border last:border-b-0"
							onclick={() => selectResult(result)}
						>
							<div class="font-medium">{result.germanTitle}</div>
							<div class="text-xs text-text-secondary mt-0.5">{result.originalTitle}</div>
							<Badge variant="accent" size="sm">TVDB: {result.tvdbId}</Badge>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Form -->
	<form class="p-4 space-y-3" onsubmit={(e) => { e.preventDefault(); handleCreateMedia(); }}>
		<Input label="Name *" placeholder="z.B. Tatort" bind:value={newMedia.name} />

		<div class="flex flex-col gap-1">
			<label class="text-sm font-medium text-text-secondary" for="media-type">Typ *</label>
			<select id="media-type" class="select" bind:value={newMedia.type}>
				<option value="show">Serie</option>
				<option value="movie">Film</option>
			</select>
		</div>

		<Input label={isShow ? 'TVDB ID *' : 'TVDB ID'} type="number" placeholder={isShow ? 'z.B. 83214' : 'Optional'} bind:value={newMedia.tvdbId} />
		<Input label={isShow ? 'TMDB ID' : 'TMDB ID *'} type="number" placeholder={isShow ? 'Optional' : 'z.B. 603'} bind:value={newMedia.tmdbId} />
		<Input label={isShow ? 'IMDB ID' : 'IMDB ID *'} placeholder={isShow ? 'Optional (z.B. tt1234567)' : 'z.B. tt0133093'} bind:value={newMedia.imdbId} />

		<!-- Show Analysis -->
		{#if selectedSearchResult && newMedia.tvdbId}
			<div class="border-t border-border pt-3 mt-3">
				<p class="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Show-Analyse</p>

				{#if showAnalysis.isLoading}
					<div class="flex justify-center py-3">
						<Spinner size="sm" />
					</div>
				{:else if showAnalysis.durationInfo || showAnalysis.showType}
					<div class="space-y-2 text-sm">
						{#if showAnalysis.durationInfo && showAnalysis.durationInfo.averageRuntime > 0}
							<div class="bg-bg rounded-md p-2.5 space-y-1">
								<div class="flex justify-between">
									<span class="text-text-secondary">Durchschn. Laufzeit</span>
									<span class="font-medium">{showAnalysis.durationInfo.averageRuntime} min</span>
								</div>
								<div class="flex justify-between">
									<span class="text-text-secondary">Analysierte Episoden</span>
									<span>{showAnalysis.durationInfo.analyzedEpisodes}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-text-secondary">Empf. Min-Dauer</span>
									<Badge variant="accent" size="sm">{showAnalysis.durationInfo.suggestedMinDuration} min</Badge>
								</div>
							</div>
						{/if}
						{#if showAnalysis.showType}
							<div class="bg-bg rounded-md p-2.5">
								<div class="flex justify-between">
									<span class="text-text-secondary">Erkannter Typ</span>
									<span class="font-medium capitalize">{showAnalysis.showType.type.replace('_', ' ')}</span>
								</div>
								<p class="text-xs text-text-tertiary mt-1">{showAnalysis.showType.reasoning}</p>
							</div>
						{/if}
						{#if showAnalysis.showData?.episodes}
							<div class="bg-bg rounded-md p-2.5">
								<div class="flex justify-between">
									<span class="text-text-secondary">Episoden (TVDB)</span>
									<span class="font-medium">{showAnalysis.showData.episodes.length}</span>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		{#if formError}
			<p class="text-sm text-error">{formError}</p>
		{/if}

		<div class="flex gap-2 pt-2">
			<Button variant="ghost" onclick={onCancel} disabled={isSaving}>
				Abbrechen
			</Button>
			<Button
				type="submit"
				variant="primary"
				disabled={!newMedia.name.trim() || !idsComplete}
				loading={isSaving}
			>
				{submitLabel}
			</Button>
		</div>
	</form>
</div>
