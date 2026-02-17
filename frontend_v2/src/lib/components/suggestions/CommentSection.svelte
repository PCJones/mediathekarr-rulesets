<script lang="ts">
	import type { Comment } from '$types/suggestion';
	import { addComment } from '$api/suggestions';
	import Button from '$components/ui/Button.svelte';

	interface Props {
		comments: Comment[];
		suggestionId: number;
		currentUser: string | null;
		onCommentAdded: () => void;
	}

	let { comments, suggestionId, currentUser, onCommentAdded }: Props = $props();

	let newComment = $state('');
	let isSubmitting = $state(false);

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function handleSubmit() {
		if (!newComment.trim() || !currentUser) return;

		isSubmitting = true;
		try {
			addComment(suggestionId, currentUser, newComment.trim());
			newComment = '';
			onCommentAdded();
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="space-y-4">
	<h3 class="font-semibold">Kommentare ({comments.length})</h3>

	{#if comments.length === 0}
		<p class="text-sm text-text-tertiary py-4">Noch keine Kommentare.</p>
	{:else}
		<div class="space-y-3">
			{#each comments as comment}
				<div class="border border-border rounded-md p-3">
					<div class="flex items-center gap-2 text-xs text-text-tertiary mb-2">
						<span class="font-medium text-text-secondary">{comment.author}</span>
						<span>{formatDate(comment.createdAt)}</span>
					</div>
					<p class="text-sm">{comment.content}</p>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Add comment form -->
	{#if currentUser}
		<div class="border-t border-border pt-4">
			<textarea
				class="input min-h-[80px] resize-y"
				placeholder="Kommentar schreiben..."
				bind:value={newComment}
			></textarea>
			<div class="flex justify-end mt-2">
				<Button
					variant="primary"
					size="sm"
					disabled={!newComment.trim()}
					loading={isSubmitting}
					onclick={handleSubmit}
				>
					Kommentieren
				</Button>
			</div>
		</div>
	{/if}
</div>
