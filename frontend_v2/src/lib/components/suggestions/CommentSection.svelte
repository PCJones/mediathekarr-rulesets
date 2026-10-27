<script lang="ts">
	import type { SuggestionComment } from '$types/suggestion';
	import { addComment } from '$api/suggestions';
	import { authStore } from '$stores/auth';
	import Button from '$components/ui/Button.svelte';
	import Avatar from './Avatar.svelte';

	interface Props {
		suggestionId: number;
		onAdded: (comment: SuggestionComment) => void;
	}

	let { suggestionId, onAdded }: Props = $props();

	let newComment = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	async function submit() {
		const content = newComment.trim();
		if (!content) return;
		isSubmitting = true;
		error = null;
		try {
			onAdded(await addComment(suggestionId, content));
			newComment = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Kommentar konnte nicht gespeichert werden';
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if $authStore.isAuthenticated}
	<div class="flex gap-3">
		<Avatar name={$authStore.user?.username ?? '?'} />
		<div class="min-w-0 flex-1 space-y-2">
			<label for="new-comment" class="block text-sm font-semibold">Kommentar</label>
			<textarea
				id="new-comment"
				class="input min-h-[96px] resize-y"
				maxlength="5000"
				bind:value={newComment}
			></textarea>
			<div class="flex items-center justify-end gap-3">
				{#if error}
					<span class="text-xs text-error">{error}</span>
				{/if}
				<Button disabled={!newComment.trim()} loading={isSubmitting} onclick={submit}>
					Kommentieren
				</Button>
			</div>
		</div>
	</div>
{:else}
	<p class="text-sm text-text-secondary">
		<a href="/login" class="text-accent hover:underline">Anmelden</a>, um zu kommentieren.
	</p>
{/if}
