<script lang="ts">
	import { onMount } from 'svelte';
	import { getAllMedia, getTvdbCoverUrl, createMedia } from '$api/media';
	import { searchShow, type SearchResult } from '$api/search';
	import { getShowData, calculateDurationInfo, detectShowType } from '$api/tvdb';
	import type { Media, DurationInfo, TvdbShowData } from '$types';

	// State
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let mediaList = $state<Media[]>([]);
	let filterQuery = $state('');
	let filterType = $state<'all' | 'show' | 'movie'>('all');

	// Search state
	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchResults = $state<SearchResult[]>([]);
	let showDropdown = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Form state
	let showForm = $state(false);
	let isSaving = $state(false);
	let newMedia = $state({
		name: '',
		type: 'show' as 'show' | 'movie',
		tvdbId: null as number | null,
		tmdbId: null as number | null,
		imdbId: ''
	});

	// Show analysis state (loaded when search result is selected)
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

	// Filtered media list (for the grid)
	let filteredMedia = $derived(() => {
		let result = mediaList;

		if (filterQuery.trim()) {
			const query = filterQuery.toLowerCase();
			result = result.filter((m) => m.name.toLowerCase().includes(query));
		}

		if (filterType !== 'all') {
			result = result.filter((m) => m.type === filterType);
		}

		return result;
	});

	// Load media on mount
	onMount(async () => {
		try {
			mediaList = await getAllMedia();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden';
		} finally {
			isLoading = false;
		}

		// Click outside to close dropdown
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	function handleClickOutside(event: MouseEvent) {
		const searchContainer = document.querySelector('.search-container');
		if (searchContainer && !searchContainer.contains(event.target as Node)) {
			closeDropdown();
		}
	}

	// Handle image error - hide broken images
	function handleImageError(event: Event) {
		const img = event.target as HTMLImageElement;
		img.style.display = 'none';
	}

	// Search handling with debounce
	function handleSearchInput(event: Event) {
		const query = (event.target as HTMLInputElement).value;
		searchQuery = query;

		if (searchTimeout) clearTimeout(searchTimeout);

		if (query.length < 2) {
			clearSearchResults();
			return;
		}

		searchTimeout = setTimeout(() => performSearch(query), 300);
	}

	async function performSearch(query: string) {
		isSearching = true;
		try {
			searchResults = await searchShow(query);
			showDropdown = true;
		} catch (e) {
			console.error('Search error:', e);
		} finally {
			isSearching = false;
		}
	}

	async function selectResult(result: SearchResult) {
		newMedia = {
			name: result.germanTitle,
			type: 'show',
			tvdbId: result.tvdbId,
			tmdbId: null,
			imdbId: ''
		};
		selectedSearchResult = result;
		closeDropdown();
		showForm = true;

		// Fetch show analysis data
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
		} catch (e) {
			console.error('Failed to load show analysis:', e);
			showAnalysis = { showData: null, durationInfo: null, showType: null, isLoading: false };
		}
	}

	function clearSearchResults() {
		searchResults = [];
		showDropdown = false;
	}

	function closeDropdown() {
		showDropdown = false;
		searchResults = [];
		searchQuery = '';
	}

	function showAddForm() {
		newMedia = { name: '', type: 'show', tvdbId: null, tmdbId: null, imdbId: '' };
		selectedSearchResult = null;
		showAnalysis = { showData: null, durationInfo: null, showType: null, isLoading: false };
		showForm = true;
	}

	function cancelForm() {
		showForm = false;
		newMedia = { name: '', type: 'show', tvdbId: null, tmdbId: null, imdbId: '' };
		selectedSearchResult = null;
		showAnalysis = { showData: null, durationInfo: null, showType: null, isLoading: false };
	}

	async function handleCreateMedia() {
		if (!newMedia.name.trim()) return;

		isSaving = true;
		error = null;

		try {
			await createMedia({
				name: newMedia.name,
				type: newMedia.type,
				tvdbId: newMedia.tvdbId,
				tmdbId: newMedia.tmdbId,
				imdbId: newMedia.imdbId || undefined
			});

			// Reload media list
			mediaList = await getAllMedia();
			showForm = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Erstellen';
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Media - MediathekArr</title>
</svelte:head>

<div class="media-page">
	<!-- Header with Search -->
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
		<div>
			<h1 class="text-3xl font-bold">Media</h1>
			<p class="text-base-content/70">Shows und Filme mit Rulesets verwalten</p>
		</div>

		<!-- Search for TVDB shows -->
		<div class="relative flex-1 max-w-xl search-container">
			<div class="flex gap-3">
				<div class="relative flex-1">
					<input
						type="text"
						value={searchQuery}
						oninput={handleSearchInput}
						placeholder="Suche nach Serien (TVDB)..."
						class="input input-bordered w-full pl-10"
					/>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					{#if isSearching}
						<span class="loading loading-spinner loading-sm absolute right-3 top-1/2 -translate-y-1/2"
						></span>
					{/if}
				</div>
			</div>

			<!-- Search Results Dropdown -->
			{#if showDropdown && searchResults.length > 0}
				<div
					class="absolute top-full left-0 right-0 mt-2 bg-base-100 rounded-box shadow-xl border border-base-content/10 z-50"
				>
					<div class="max-h-96 overflow-y-auto">
						{#each searchResults as result}
							<button
								type="button"
								class="w-full p-4 hover:bg-base-200 cursor-pointer transition-colors border-b border-base-content/10 last:border-b-0 text-left"
								onclick={() => selectResult(result)}
							>
								<div class="flex justify-between items-start gap-4">
									<div class="flex-1">
										<h3 class="font-bold">{result.germanTitle}</h3>
										<p class="text-sm text-base-content/70">{result.originalTitle}</p>
									</div>
									<span class="badge badge-primary">TVDB: {result.tvdbId}</span>
								</div>
								{#if result.aliases?.length}
									<div class="mt-2 flex flex-wrap gap-1">
										{#each result.aliases.slice(0, 3) as alias}
											<span class="badge badge-ghost badge-sm">{alias}</span>
										{/each}
										{#if result.aliases.length > 3}
											<span class="badge badge-ghost badge-sm">+{result.aliases.length - 3}</span>
										{/if}
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- No Results -->
			{#if showDropdown && searchResults.length === 0 && !isSearching && searchQuery.length >= 2}
				<div
					class="absolute top-full left-0 right-0 mt-2 p-4 bg-base-100 rounded-box shadow-xl border border-base-content/10 z-50"
				>
					<p class="text-center text-base-content/70">Keine Ergebnisse gefunden</p>
				</div>
			{/if}
		</div>

		<button class="btn btn-primary" onclick={showAddForm}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5 mr-1"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
					clip-rule="evenodd"
				/>
			</svg>
			Manuell hinzufügen
		</button>
	</div>

	<!-- Filter for existing media list -->
	<div class="flex flex-wrap gap-4 mb-6">
		<div class="form-control">
			<input
				type="text"
				placeholder="Liste filtern..."
				class="input input-bordered w-full md:w-64"
				bind:value={filterQuery}
			/>
		</div>
		<div class="form-control">
			<select class="select select-bordered" bind:value={filterType}>
				<option value="all">Alle Typen</option>
				<option value="show">Serien</option>
				<option value="movie">Filme</option>
			</select>
		</div>
	</div>

	<!-- Main content with optional form panel -->
	<div class="flex flex-col lg:flex-row gap-6">
		<!-- Add/Edit Form Panel -->
		{#if showForm}
			<div class="lg:w-1/3 bg-base-100 rounded-box border border-base-content/10 sticky top-4 self-start">
				<div class="p-4 border-b border-base-content/10">
					<h2 class="text-xl font-bold">Neues Medium</h2>
				</div>
				<form class="p-4 space-y-4" onsubmit={(e) => { e.preventDefault(); handleCreateMedia(); }}>
					<div class="form-control">
						<label class="label" for="media-name">
							<span class="label-text">Name *</span>
						</label>
						<input
							id="media-name"
							type="text"
							class="input input-bordered"
							placeholder="z.B. Tatort"
							bind:value={newMedia.name}
						/>
					</div>

					<div class="form-control">
						<label class="label" for="media-type">
							<span class="label-text">Typ *</span>
						</label>
						<select id="media-type" class="select select-bordered w-full" bind:value={newMedia.type}>
							<option value="show">Serie</option>
							<option value="movie">Film</option>
						</select>
					</div>

					<div class="form-control">
						<label class="label" for="media-tvdb">
							<span class="label-text">TVDB ID</span>
						</label>
						<input
							id="media-tvdb"
							type="number"
							class="input input-bordered"
							placeholder="Optional"
							bind:value={newMedia.tvdbId}
						/>
					</div>

					<div class="form-control">
						<label class="label" for="media-tmdb">
							<span class="label-text">TMDB ID</span>
						</label>
						<input
							id="media-tmdb"
							type="number"
							class="input input-bordered"
							placeholder="Optional"
							bind:value={newMedia.tmdbId}
						/>
					</div>

					<div class="form-control">
						<label class="label" for="media-imdb">
							<span class="label-text">IMDB ID</span>
						</label>
						<input
							id="media-imdb"
							type="text"
							class="input input-bordered"
							placeholder="Optional (z.B. tt1234567)"
							bind:value={newMedia.imdbId}
						/>
					</div>

					<!-- Show Analysis (when selected from search) -->
					{#if selectedSearchResult && newMedia.tvdbId}
						<div class="divider text-xs text-base-content/50">Show-Analyse</div>

						{#if showAnalysis.isLoading}
							<div class="flex justify-center py-4">
								<span class="loading loading-spinner loading-md"></span>
							</div>
						{:else if showAnalysis.durationInfo || showAnalysis.showType}
							<div class="space-y-3 text-sm">
								<!-- Duration Info -->
								{#if showAnalysis.durationInfo && showAnalysis.durationInfo.averageRuntime > 0}
									<div class="bg-base-200 rounded-lg p-3">
										<div class="flex justify-between items-center">
											<span class="text-base-content/70">Durchschn. Laufzeit</span>
											<span class="font-semibold">{showAnalysis.durationInfo.averageRuntime} min</span>
										</div>
										<div class="flex justify-between items-center mt-1">
											<span class="text-base-content/70">Episoden analysiert</span>
											<span>{showAnalysis.durationInfo.analyzedEpisodes}</span>
										</div>
										<div class="flex justify-between items-center mt-1">
											<span class="text-base-content/70">Empf. Min-Dauer (70%)</span>
											<span class="badge badge-primary badge-sm">{showAnalysis.durationInfo.suggestedMinDuration} min</span>
										</div>
									</div>
								{/if}

								<!-- Show Type -->
								{#if showAnalysis.showType}
									<div class="bg-base-200 rounded-lg p-3">
										<div class="flex justify-between items-center">
											<span class="text-base-content/70">Erkannter Typ</span>
											<span class="font-semibold capitalize">{showAnalysis.showType.type.replace('_', ' ')}</span>
										</div>
										<p class="text-xs text-base-content/50 mt-1">{showAnalysis.showType.reasoning}</p>
									</div>
								{/if}

								<!-- Episode Count -->
								{#if showAnalysis.showData?.episodes}
									<div class="bg-base-200 rounded-lg p-3">
										<div class="flex justify-between items-center">
											<span class="text-base-content/70">Episoden (TVDB)</span>
											<span class="font-semibold">{showAnalysis.showData.episodes.length}</span>
										</div>
									</div>
								{/if}

								<!-- Aliases -->
								{#if selectedSearchResult.aliases && selectedSearchResult.aliases.length > 0}
									<div class="bg-base-200 rounded-lg p-3">
										<p class="text-base-content/70 mb-2">Alternative Titel:</p>
										<div class="flex flex-wrap gap-1">
											{#each selectedSearchResult.aliases.slice(0, 4) as alias}
												<span class="badge badge-outline badge-sm">{alias}</span>
											{/each}
											{#if selectedSearchResult.aliases.length > 4}
												<span class="badge badge-ghost badge-sm">+{selectedSearchResult.aliases.length - 4}</span>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					{/if}

					<div class="flex gap-3 pt-2">
						<button type="button" class="btn btn-ghost flex-1" onclick={cancelForm} disabled={isSaving}>
							Abbrechen
						</button>
						<button
							type="submit"
							class="btn btn-primary flex-1"
							disabled={!newMedia.name.trim() || isSaving}
						>
							{#if isSaving}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Hinzufügen
						</button>
					</div>
				</form>
			</div>
		{/if}

		<!-- Media list area -->
		<div class="flex-1">
			{#if isLoading}
				<div class="flex justify-center py-12">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if error}
				<div class="alert alert-error">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{error}</span>
				</div>
			{:else if filteredMedia().length === 0}
				<div class="text-center py-12">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-16 w-16 mx-auto mb-4 text-base-content/30"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
						/>
					</svg>
					<p class="text-lg text-base-content/60">Kein Medium gefunden</p>
					<p class="text-sm text-base-content/40 mt-2">Suche oben nach einer Serie oder füge manuell hinzu</p>
				</div>
			{:else}
				<!-- Media grid -->
				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
					{#each filteredMedia() as media}
						<div class="card bg-base-100 shadow hover:shadow-lg transition-shadow">
							<figure class="h-32 bg-base-200 overflow-hidden">
								{#if media.tvdbId}
									<img
										src={getTvdbCoverUrl(media.tvdbId)}
										alt={media.name}
										class="w-full h-full object-cover"
										onerror={handleImageError}
									/>
								{:else}
									<div class="flex items-center justify-center h-full w-full">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-12 w-12 text-base-content/20"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
											/>
										</svg>
									</div>
								{/if}
							</figure>
							<div class="card-body p-4">
								<h2 class="card-title text-lg">{media.name}</h2>
								<div class="flex flex-wrap gap-2">
									<span
										class="badge"
										class:badge-primary={media.type === 'show'}
										class:badge-secondary={media.type === 'movie'}
									>
										{media.type === 'show' ? 'Serie' : 'Film'}
									</span>
									{#if media.tvdbId}
										<span class="badge badge-ghost badge-sm">TVDB: {media.tvdbId}</span>
									{/if}
								</div>
								<div class="card-actions justify-end mt-3">
									<a href="/media/{media.id}/rulesets" class="btn btn-primary btn-sm"> Rulesets </a>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
