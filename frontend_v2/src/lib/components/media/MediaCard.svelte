<script lang="ts">
	import type { Media } from '$types';
	import Badge from '$components/ui/Badge.svelte';
	import { getTvdbCoverUrl } from '$api/media';

	interface Props {
		media: Media;
	}

	let { media }: Props = $props();

	function handleImageError(event: Event) {
		const img = event.target as HTMLImageElement;
		img.style.display = 'none';
	}
</script>

<!-- The card body is covered by a stretched link so the suggestions badge can stay its own link. -->
<div class="card group relative hover:border-accent transition-colors">
	<a
		href="/media/{media.id}/rulesets"
		class="absolute inset-0 rounded-lg"
		aria-label="Rulesets für {media.name}"
	></a>

	<!-- Cover image -->
	<div class="h-32 bg-surface-raised overflow-hidden rounded-t-lg flex items-center justify-center">
		{#if media.tvdbId}
			<img
				src={getTvdbCoverUrl(media.tvdbId)}
				alt={media.name}
				class="w-full h-full object-cover"
				onerror={handleImageError}
			/>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-text-tertiary opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
			</svg>
		{/if}
	</div>

	<!-- Info -->
	<div class="p-3">
		<h3 class="font-semibold truncate group-hover:text-accent transition-colors">{media.name}</h3>
		<div class="flex flex-wrap items-center gap-1.5 mt-2">
			<Badge variant={media.type === 'show' ? 'accent' : 'info'} size="sm">
				{media.type === 'show' ? 'Serie' : 'Film'}
			</Badge>
			{#if media.tvdbId}
				<Badge size="sm">TVDB: {media.tvdbId}</Badge>
			{/if}
			{#if media.openSuggestions}
				<a
					href="/suggestions?mediaId={media.id}"
					class="badge badge-sm relative hover:border-accent hover:text-accent"
				>
					{media.openSuggestions}
					{media.openSuggestions === 1 ? 'Vorschlag' : 'Vorschläge'}
				</a>
			{/if}
		</div>
	</div>
</div>
