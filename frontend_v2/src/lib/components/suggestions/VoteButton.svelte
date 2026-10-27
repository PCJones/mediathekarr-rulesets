<script lang="ts">
	import { voteSuggestion, unvoteSuggestion } from '$api/suggestions';
	import { authStore } from '$stores/auth';

	interface Props {
		suggestionId: number;
		votes: number;
		hasVoted: boolean;
	}

	let { suggestionId, votes = $bindable(), hasVoted = $bindable() }: Props = $props();

	let isBusy = $state(false);
	let error = $state<string | null>(null);

	let canVote = $derived($authStore.isAuthenticated);

	async function toggle() {
		if (!canVote || isBusy) return;

		const previous = { votes, hasVoted };
		hasVoted = !previous.hasVoted;
		votes = previous.votes + (hasVoted ? 1 : -1);
		isBusy = true;
		error = null;

		try {
			const result = previous.hasVoted
				? await unvoteSuggestion(suggestionId)
				: await voteSuggestion(suggestionId);
			votes = result.votes;
			hasVoted = result.hasVoted;
		} catch (e) {
			votes = previous.votes;
			hasVoted = previous.hasVoted;
			error = e instanceof Error ? e.message : 'Abstimmen fehlgeschlagen';
		} finally {
			isBusy = false;
		}
	}
</script>

<div class="flex flex-col items-end gap-1">
	<button
		type="button"
		class="inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-md border-[1.5px] border-accent text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
		class:bg-accent={hasVoted}
		class:text-accent-text={hasVoted}
		class:text-accent={!hasVoted}
		class:vote-idle={!hasVoted}
		class:opacity-60={isBusy}
		aria-pressed={hasVoted}
		aria-label={`${hasVoted ? 'Upvote entfernen' : 'Upvote'} (${votes} ${votes === 1 ? 'Stimme' : 'Stimmen'})`}
		disabled={!canVote}
		title={canVote ? (hasVoted ? 'Upvote entfernen' : 'Upvote') : undefined}
		onclick={toggle}
	>
		<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
		</svg>
		<span class="font-mono tabular-nums">{votes}</span>
	</button>

	{#if !canVote}
		<a href="/login" class="text-xs text-accent hover:underline">Anmelden, um abzustimmen</a>
	{/if}
	{#if error}
		<p class="text-xs text-error">{error}</p>
	{/if}
</div>

<style>
	.vote-idle {
		background-color: color-mix(in srgb, var(--color-accent) 8%, transparent);
	}
	.vote-idle:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--color-accent) 16%, transparent);
	}
</style>
