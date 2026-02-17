<script lang="ts">
	import type { Suggestion } from '$types/suggestion';
	import { addVote, removeVote, getVoteScore } from '$api/suggestions';

	interface Props {
		suggestion: Suggestion;
		userId: string;
		onVoteChanged: () => void;
	}

	let { suggestion, userId, onVoteChanged }: Props = $props();

	let currentVote = $derived(
		suggestion.votes.find(v => v.userId === userId)?.direction || null
	);

	let score = $derived(getVoteScore(suggestion));

	function handleVote(direction: 'up' | 'down') {
		if (currentVote === direction) {
			removeVote(suggestion.id, userId);
		} else {
			addVote(suggestion.id, userId, direction);
		}
		onVoteChanged();
	}
</script>

<div class="flex flex-col items-center gap-1">
	<button
		class="rounded p-1 transition-colors"
		class:text-success={currentVote === 'up'}
		class:text-text-tertiary={currentVote !== 'up'}
		class:hover:text-success={currentVote !== 'up'}
		onclick={() => handleVote('up')}
		aria-label="Upvote"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
		</svg>
	</button>

	<span class="text-lg font-semibold" class:text-success={score > 0} class:text-error={score < 0}>
		{score}
	</span>

	<button
		class="rounded p-1 transition-colors"
		class:text-error={currentVote === 'down'}
		class:text-text-tertiary={currentVote !== 'down'}
		class:hover:text-error={currentVote !== 'down'}
		onclick={() => handleVote('down')}
		aria-label="Downvote"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
		</svg>
	</button>
</div>
