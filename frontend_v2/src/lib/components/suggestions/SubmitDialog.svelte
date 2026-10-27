<script lang="ts">
	import type { BundleCoverage, ChangeCounts } from '$types/suggestion';
	import Modal from '$components/ui/Modal.svelte';
	import Button from '$components/ui/Button.svelte';
	import ChangeChips from './ChangeChips.svelte';
	import CoverageDelta from './CoverageDelta.svelte';

	interface Props {
		open?: boolean;
		title?: string;
		mediaName: string;
		counts: ChangeCounts;
		coverage: BundleCoverage | null;
		description?: string;
		isSubmitting?: boolean;
		error?: string | null;
		onSubmit: (description: string) => void;
	}

	let {
		open = $bindable(false),
		title = 'Vorschlag einreichen',
		mediaName,
		counts,
		coverage,
		description = $bindable(''),
		isSubmitting = false,
		error = null,
		onSubmit
	}: Props = $props();

	let tooShort = $derived(description.trim().length < 10);
</script>

<Modal bind:open {title}>
	<div class="space-y-4 sm:w-[28rem]">
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<span class="font-medium">{mediaName}</span>
			<ChangeChips {counts} />
			<CoverageDelta {coverage} size="sm" />
		</div>

		<div class="flex flex-col gap-1">
			<label class="text-sm font-medium text-text-secondary" for="suggestion-description">
				Begründung *
			</label>
			<textarea
				id="suggestion-description"
				class="input min-h-[120px] resize-y"
				placeholder="Was ändert dieser Vorschlag und warum?"
				bind:value={description}
			></textarea>
			<p class="text-xs" class:text-error={tooShort} class:text-text-tertiary={!tooShort}>
				Mindestens 10 Zeichen.
			</p>
		</div>

		{#if error}
			<p class="text-sm text-error">{error}</p>
		{/if}

		<div class="flex justify-end gap-2">
			<Button variant="ghost" onclick={() => (open = false)} disabled={isSubmitting}>Abbrechen</Button>
			<Button
				variant="primary"
				disabled={tooShort}
				loading={isSubmitting}
				onclick={() => onSubmit(description.trim())}
			>
				Einreichen
			</Button>
		</div>
	</div>
</Modal>
