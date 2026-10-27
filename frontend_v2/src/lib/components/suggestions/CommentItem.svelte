<script lang="ts">
	import type { SuggestionComment } from '$types/suggestion';
	import { editComment, deleteComment } from '$api/suggestions';
	import { authStore, isAdmin } from '$stores/auth';
	import { formatRelative, formatDate } from '$utils/time';
	import Button from '$components/ui/Button.svelte';
	import Avatar from './Avatar.svelte';

	interface Props {
		suggestionId: number;
		comment: SuggestionComment;
		/** Username of the proposal's author, marked in the header. */
		author: string;
		onUpdated: (comment: SuggestionComment) => void;
		onRemoved: () => void;
	}

	let { suggestionId, comment, author, onUpdated, onRemoved }: Props = $props();

	let isEditing = $state(false);
	let editContent = $state('');
	let error = $state<string | null>(null);
	let isSaving = $state(false);

	let isOwn = $derived(
		!comment.deleted && $authStore.user?.id != null && comment.author.id === $authStore.user.id
	);
	let canDelete = $derived(!comment.deleted && (isOwn || $isAdmin));

	function startEdit() {
		editContent = comment.content ?? '';
		error = null;
		isEditing = true;
	}

	async function save() {
		const content = editContent.trim();
		if (!content || isSaving) return;
		isSaving = true;
		try {
			onUpdated(await editComment(suggestionId, comment.id, content));
			isEditing = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Kommentar konnte nicht gespeichert werden';
		} finally {
			isSaving = false;
		}
	}

	async function remove() {
		if (!confirm('Kommentar wirklich löschen?')) return;
		try {
			await deleteComment(suggestionId, comment.id);
			onRemoved();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Kommentar konnte nicht gelöscht werden';
		}
	}
</script>

<li class="relative flex gap-3">
	<Avatar name={comment.author.username} highlight={comment.author.username === author} />
	<div class="min-w-0 flex-1 rounded-lg border border-border-strong bg-bg overflow-hidden">
		<div class="flex items-center justify-between gap-2 px-3 py-1.5 bg-surface border-b border-border text-[0.8125rem] text-text-secondary">
			<span>
				<strong class="font-semibold text-text">@{comment.author.username}</strong> ·
				<span title={formatDate(comment.createdAt)}>{formatRelative(comment.createdAt)}</span>
				{#if comment.editedAt}
					<span title={formatDate(comment.editedAt)}>· bearbeitet</span>
				{/if}
			</span>
			<span class="flex items-center gap-3">
				{#if comment.author.username === author}
					<span class="badge badge-sm">Autor</span>
				{/if}
				{#if !isEditing && isOwn}
					<button type="button" class="text-xs hover:text-text transition-colors" onclick={startEdit}>
						Bearbeiten
					</button>
				{/if}
				{#if !isEditing && canDelete}
					<button type="button" class="text-xs hover:text-error transition-colors" onclick={remove}>
						Löschen
					</button>
				{/if}
			</span>
		</div>

		{#if comment.deleted}
			<p class="px-3 py-2.5 text-sm italic text-text-tertiary">Kommentar entfernt</p>
		{:else if isEditing}
			<div class="p-3 space-y-2">
				<textarea class="input min-h-[80px] resize-y" maxlength="5000" bind:value={editContent}></textarea>
				<div class="flex justify-end gap-2">
					<Button variant="ghost" size="sm" onclick={() => (isEditing = false)}>Abbrechen</Button>
					<Button variant="primary" size="sm" disabled={!editContent.trim()} loading={isSaving} onclick={save}>
						Speichern
					</Button>
				</div>
			</div>
		{:else}
			<p class="px-3 py-2.5 text-sm whitespace-pre-wrap">{comment.content}</p>
		{/if}

		{#if error}
			<p class="px-3 pb-2.5 text-xs text-error">{error}</p>
		{/if}
	</div>
</li>
