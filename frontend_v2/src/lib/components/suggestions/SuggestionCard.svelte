<script lang="ts">
	import type { Suggestion } from '$types/suggestion';
	import { getVoteScore } from '$api/suggestions';
	import Badge from '$components/ui/Badge.svelte';

	interface Props {
		suggestion: Suggestion;
	}

	let { suggestion }: Props = $props();

	let statusVariant = $derived(
		suggestion.status === 'accepted' ? 'success' as const :
		suggestion.status === 'rejected' ? 'error' as const : 'info' as const
	);

	let statusLabel = $derived(
		suggestion.status === 'accepted' ? 'Angenommen' :
		suggestion.status === 'rejected' ? 'Abgelehnt' : 'Offen'
	);

	let voteScore = $derived(getVoteScore(suggestion));

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}
</script>

<a
	href="/suggestions/{suggestion.id}"
	class="card hover:border-accent transition-colors block"
>
	<div class="p-4">
		<div class="flex items-start justify-between gap-3">
			<div class="flex-1 min-w-0">
				<h3 class="font-semibold truncate">{suggestion.title}</h3>
				<p class="text-sm text-text-secondary mt-1 line-clamp-2">{suggestion.description}</p>
			</div>
			<Badge variant={statusVariant}>{statusLabel}</Badge>
		</div>

		<div class="flex flex-wrap items-center gap-3 mt-3 text-xs text-text-tertiary">
			<span>{suggestion.media.name}</span>
			<span>von {suggestion.author}</span>
			<span>{formatDate(suggestion.createdAt)}</span>

			<!-- Vote score -->
			<span class="flex items-center gap-1" class:text-success={voteScore > 0} class:text-error={voteScore < 0}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
					{#if voteScore >= 0}
						<path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
					{:else}
						<path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					{/if}
				</svg>
				{voteScore}
			</span>

			<!-- Comment count -->
			<span class="flex items-center gap-1">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
				</svg>
				{suggestion.comments.length}
			</span>

			<!-- Match rate -->
			<Badge variant={suggestion.testResults.matchRate >= 80 ? 'success' : suggestion.testResults.matchRate >= 50 ? 'warning' : 'error'} size="sm">
				{suggestion.testResults.matchRate}% Match
			</Badge>
		</div>
	</div>
</a>
