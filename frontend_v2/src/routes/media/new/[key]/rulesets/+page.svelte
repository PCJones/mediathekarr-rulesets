<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getShowData, calculateDurationInfo } from '$api/tvdb';
	import { suggestionDraft } from '$stores/suggestionDraft';
	import type { Media, DurationInfo, TvdbShowData } from '$types';
	import type { ProposedMedia } from '$types/suggestion';
	import MediaRulesetsView from '$components/media/MediaRulesetsView.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	let draftKey = $derived($page.params.key ?? '');

	let isLoading = $state(true);
	let proposedMedia = $state<ProposedMedia | null>(null);
	let durationInfo = $state<DurationInfo | null>(null);
	let tvdbShowData = $state<TvdbShowData | null>(null);

	let media = $derived<Media | null>(
		proposedMedia
			? {
					id: 0,
					name: proposedMedia.name,
					type: proposedMedia.type,
					tvdbId: proposedMedia.tvdbId ?? null,
					tmdbId: proposedMedia.tmdbId ?? null,
					imdbId: proposedMedia.imdbId ?? null
				}
			: null
	);

	let loadedKey = $state<string | null>(null);

	$effect(() => {
		const key = draftKey;
		if (loadedKey === key) return;
		loadedKey = key;
		untrack(() => load(key));
	});

	async function load(key: string) {
		isLoading = true;
		if (!key || !suggestionDraft.exists(key)) {
			await goto('/media');
			return;
		}

		const state = suggestionDraft.open(key);
		proposedMedia = state.proposedMedia;
		isLoading = false;

		if (proposedMedia?.tvdbId) {
			try {
				const showData = await getShowData(proposedMedia.tvdbId);
				if (showData?.episodes) {
					tvdbShowData = showData;
					durationInfo = calculateDurationInfo(showData.episodes);
				}
			} catch {
				// TVDB data is optional
			}
		}
	}
</script>

<svelte:head>
	<title>{proposedMedia?.name || 'Neue Serie'} - MediathekArr</title>
</svelte:head>

{#if isLoading}
	<div class="flex justify-center py-12">
		<Spinner size="lg" />
	</div>
{:else if media && proposedMedia}
	<MediaRulesetsView
		{media}
		liveRulesets={[]}
		{durationInfo}
		{tvdbShowData}
		{proposedMedia}
		{draftKey}
	/>
{:else}
	<Alert variant="error">Kein Entwurf gefunden.</Alert>
{/if}
