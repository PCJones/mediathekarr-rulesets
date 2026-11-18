<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getSuggestion } from '$api/suggestions';
	import { getShowData, calculateDurationInfo, TVDB_UNAVAILABLE_MESSAGE } from '$api/tvdb';
	import { authStore } from '$stores/auth';
	import { suggestionDraftKey } from '$stores/suggestionDraft';
	import type { Media, DurationInfo, TvdbShowData } from '$types';
	import type { ProposedMedia } from '$types/suggestion';
	import MediaRulesetsView from '$components/media/MediaRulesetsView.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	/**
	 * Wizard for a submitted proposal whose media does not exist yet:
	 * `?view=suggestion:<id>` is read-only for everyone, `?draft=suggestion:<id>` edits it
	 * (author or admin, open proposals only — MediaRulesetsView enforces that).
	 */

	let suggestionId = $derived(Number($page.params.id));

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let proposedMedia = $state<ProposedMedia | null>(null);
	let durationInfo = $state<DurationInfo | null>(null);
	let tvdbShowData = $state<TvdbShowData | null>(null);
	let tvdbUnavailable = $state(false);

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

	let loadedId: number | null = null;

	$effect(() => {
		const current = suggestionId;
		if (loadedId === current) return;
		loadedId = current;
		untrack(() => load(current));
	});

	/** Only `view=` and `draft=` deep links are meaningful here; guests can only view. */
	function normalisedSearch(id: number): string | null {
		const params = $page.url.searchParams;
		const viewLink = `suggestion:${id}`;
		const wantsView = params.get('view') === viewLink;
		const wantsDraft = params.get('draft') === viewLink;
		if (wantsView || (wantsDraft && $authStore.isAuthenticated)) return null;

		const normalised = new URLSearchParams({ view: viewLink });
		const changeKey = params.get('change');
		if (changeKey) normalised.set('change', changeKey);
		return `?${normalised.toString()}`;
	}

	async function load(id: number) {
		isLoading = true;
		error = null;
		proposedMedia = null;
		durationInfo = null;
		tvdbShowData = null;
		tvdbUnavailable = false;

		if (!Number.isFinite(id)) {
			error = 'Ungültige Vorschlags-ID';
			isLoading = false;
			return;
		}

		try {
			const detail = await getSuggestion(id);
			if (id !== suggestionId) return;

			// accepted proposals (and those re-pointed at an existing media) live on the media page
			if (detail.media) {
				await goto(`/media/${detail.media.id}/rulesets${$page.url.search}`, { replaceState: true });
				return;
			}
			if (!detail.proposedMedia) {
				error = 'Das Medium dieses Vorschlags existiert nicht mehr.';
				return;
			}

			const correctedSearch = normalisedSearch(id);
			if (correctedSearch !== null) {
				await goto(`/suggestions/${id}/rulesets${correctedSearch}`, { replaceState: true });
			}

			proposedMedia = detail.proposedMedia;
			isLoading = false;

			if (proposedMedia.tvdbId) {
				try {
					const showData = await getShowData(proposedMedia.tvdbId);
					if (id !== suggestionId) return;
					if (showData?.episodes) {
						tvdbShowData = showData;
						durationInfo = calculateDurationInfo(showData.episodes);
					} else {
						tvdbUnavailable = true;
					}
				} catch {
					// TVDB data is optional, but the user should know the preview is degraded
					tvdbUnavailable = true;
				}
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Vorschlag konnte nicht geladen werden';
		} finally {
			if (id === suggestionId) isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{proposedMedia?.name || `Vorschlag #${suggestionId}`} - MediathekArr</title>
</svelte:head>

{#if isLoading}
	<div class="flex justify-center py-12">
		<Spinner size="lg" />
	</div>
{:else if error}
	<div class="space-y-4">
		<a href="/suggestions/{suggestionId}" class="text-sm text-text-secondary hover:text-text">← Vorschlag #{suggestionId}</a>
		<Alert variant="error">{error}</Alert>
	</div>
{:else if media && proposedMedia}
	{#if tvdbUnavailable}
		<div class="mb-4">
			<Alert variant="warning">{TVDB_UNAVAILABLE_MESSAGE}</Alert>
		</div>
	{/if}
	<MediaRulesetsView
		{media}
		liveRulesets={[]}
		{durationInfo}
		{tvdbShowData}
		{proposedMedia}
		draftKey={suggestionDraftKey(suggestionId)}
	/>
{/if}
