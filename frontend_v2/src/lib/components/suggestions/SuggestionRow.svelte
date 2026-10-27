<script lang="ts">
	import type { SuggestionSummary } from '$types/suggestion';
	import { formatDate, formatRelative } from '$utils/time';
	import { mediaTypeLabel, newMediaLabel, statusLabel, statusVariant } from '$utils/suggestion';
	import Badge from '$components/ui/Badge.svelte';
	import ChangeChips from './ChangeChips.svelte';
	import Delta from './Delta.svelte';

	interface Props {
		suggestion: SuggestionSummary;
	}

	let { suggestion }: Props = $props();

	let name = $derived(suggestion.media?.name ?? suggestion.proposedMedia?.name ?? 'Unbekannt');
	let type = $derived(suggestion.media?.type ?? suggestion.proposedMedia?.type ?? null);
	let coverage = $derived(suggestion.coverage);
</script>

<a
	href="/suggestions/{suggestion.id}"
	class="card hover:border-accent transition-colors block p-4"
>
	<div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
			<span class="font-semibold">{name}</span>
			{#if type}
				<Badge variant={type === 'show' ? 'accent' : 'info'} size="sm">{mediaTypeLabel(type)}</Badge>
			{/if}
			{#if suggestion.proposedMedia}
				<Badge size="sm">{newMediaLabel(suggestion.proposedMedia.type)}</Badge>
			{/if}
			<ChangeChips counts={suggestion.changeCounts} />
			{#if coverage}
				<span title="Mediathek-Videos, die einer TVDB-Episode zugeordnet werden">
					<Delta
						label="Zugeordnet"
						before={coverage.before.coveredByAny}
						after={coverage.after.coveredByAny}
					/>
				</span>
			{:else}
				<span class="text-xs text-text-tertiary">Keine Messdaten</span>
			{/if}
		</div>

		<div class="flex items-center gap-2 shrink-0 md:ml-auto">
			<Badge variant={suggestion.hasVoted ? 'accent' : 'default'} size="sm">
				<span class="font-mono tabular-nums">▲ {suggestion.votes}</span>
			</Badge>
			<span class="flex items-center gap-1 text-xs text-text-tertiary" title="{suggestion.comments} Kommentare">
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
					/>
				</svg>
				<span class="font-mono tabular-nums">{suggestion.comments}</span>
			</span>
			<Badge variant={statusVariant(suggestion.status)} size="sm">
				{statusLabel(suggestion.status)}
			</Badge>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-text-tertiary">
		<span>@{suggestion.author.username}</span>
		<span>·</span>
		<span title={formatDate(suggestion.createdAt)}>{formatRelative(suggestion.createdAt)}</span>
		<span>·</span>
		<span>Rev {suggestion.currentRevision}</span>
		{#if suggestion.isStale}
			<span class="md:ml-auto">
				<Badge variant="warning" size="sm">Veraltet</Badge>
			</span>
		{/if}
	</div>
</a>
