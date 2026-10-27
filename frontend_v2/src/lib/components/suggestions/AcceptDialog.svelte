<script lang="ts">
	import type { BundleCoverage, ChangeCounts } from '$types/suggestion';
	import Modal from '$components/ui/Modal.svelte';
	import Button from '$components/ui/Button.svelte';
	import ChangeChips from './ChangeChips.svelte';
	import CoverageDelta from './CoverageDelta.svelte';

	interface Props {
		open?: boolean;
		suggestionId: number;
		counts: ChangeCounts;
		coverage: BundleCoverage | null;
		/** The bundle carries an explicit order list. */
		reorders?: boolean;
		comment?: string;
		isSubmitting?: boolean;
		error?: string | null;
		onAccept: (comment: string) => void;
	}

	let {
		open = $bindable(false),
		suggestionId,
		counts,
		coverage,
		reorders = false,
		comment = $bindable(''),
		isSubmitting = false,
		error = null,
		onAccept
	}: Props = $props();

	let summary = $derived.by(() => {
		const parts: string[] = [];
		// the noun rides on the first part only: "1 Ruleset erstellt, 2 geändert"
		const add = (n: number, verb: string) => {
			if (n === 0) return;
			parts.push(parts.length === 0 ? `${n} Ruleset${n === 1 ? '' : 's'} ${verb}` : `${n} ${verb}`);
		};
		add(counts.create, 'erstellt');
		add(counts.update, 'geändert');
		add(counts.delete, 'gelöscht');
		if (reorders) parts.push('die Reihenfolge angepasst');
		if (parts.length === 0) return 'Es werden keine Änderungen angewendet.';
		const head = parts.slice(0, -1).join(', ');
		return `Es werden ${head ? `${head} und ` : ''}${parts.at(-1)}.`;
	});
</script>

<Modal bind:open title="Vorschlag #{suggestionId} annehmen">
	<div class="space-y-4 sm:w-[28rem]">
		<p class="text-sm">{summary}</p>

		<div class="flex flex-wrap items-center gap-2 text-sm">
			<ChangeChips {counts} />
			<CoverageDelta {coverage} size="sm" />
		</div>

		<div class="flex flex-col gap-1">
			<label class="text-sm font-medium text-text-secondary" for="accept-comment">Kommentar</label>
			<textarea
				id="accept-comment"
				class="input min-h-[80px] resize-y"
				placeholder="Optional"
				bind:value={comment}
			></textarea>
		</div>

		{#if error}
			<p class="text-sm text-error">{error}</p>
		{/if}

		<div class="flex justify-end gap-2">
			<Button variant="ghost" onclick={() => (open = false)} disabled={isSubmitting}>Abbrechen</Button>
			<Button variant="primary" loading={isSubmitting} onclick={() => onAccept(comment.trim())}>
				Annehmen
			</Button>
		</div>
	</div>
</Modal>
