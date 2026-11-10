<script lang="ts">
	import { page } from '$app/stores';
	import { getMedia } from '$api/media';
	import { getRulesetsForMedia } from '$api/rulesets';
	import { getShowData, calculateDurationInfo, TVDB_UNAVAILABLE_MESSAGE } from '$api/tvdb';
	import type { Media, Ruleset, DurationInfo, TvdbShowData } from '$types';
	import MediaRulesetsView from '$components/media/MediaRulesetsView.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	let mediaId = $derived(Number($page.params.mediaId));

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let media = $state<Media | null>(null);
	let rulesets = $state<Ruleset[]>([]);
	let durationInfo = $state<DurationInfo | null>(null);
	let tvdbShowData = $state<TvdbShowData | null>(null);
	let tvdbUnavailable = $state(false);

	$effect(() => {
		const id = mediaId;
		loadData(id);
	});

	async function loadData(id: number) {
		isLoading = true;
		error = null;
		durationInfo = null;
		tvdbShowData = null;
		tvdbUnavailable = false;

		try {
			media = await getMedia(id);
			rulesets = await getRulesetsForMedia(id);

			if (media.tvdbId) {
				try {
					const showDataResponse = await getShowData(media.tvdbId);
					if (showDataResponse?.episodes) {
						tvdbShowData = showDataResponse;
						durationInfo = calculateDurationInfo(showDataResponse.episodes);
					} else {
						tvdbUnavailable = true;
					}
				} catch {
					// TVDB data is optional, but the user should know the preview is degraded
					tvdbUnavailable = true;
				}
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden';
		} finally {
			isLoading = false;
		}
	}

	async function reload() {
		rulesets = await getRulesetsForMedia(mediaId);
	}
</script>

<svelte:head>
	<title>{media?.name || 'Rulesets'} - MediathekArr</title>
</svelte:head>

{#if isLoading}
	<div class="flex justify-center py-12">
		<Spinner size="lg" />
	</div>
{:else if error}
	<Alert variant="error">{error}</Alert>
{:else if media}
	{#if tvdbUnavailable}
		<div class="mb-4">
			<Alert variant="warning">{TVDB_UNAVAILABLE_MESSAGE}</Alert>
		</div>
	{/if}
	<MediaRulesetsView
		{media}
		liveRulesets={rulesets}
		{durationInfo}
		{tvdbShowData}
		onReload={reload}
	/>
{/if}
