<script lang="ts">
	import type { BundleCoverage, ChangeCounts } from '$types/suggestion';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Spinner from '$components/ui/Spinner.svelte';
	import ChangeChips from './ChangeChips.svelte';
	import CoverageDelta from './CoverageDelta.svelte';

	interface Props {
		counts: ChangeCounts;
		coverage: BundleCoverage | null;
		coverageLoading?: boolean;
		mode?: 'submit' | 'save';
		suggestionId?: number | null;
		revision?: number | null;
		hasUnsavedEdits?: boolean;
		disabledReason?: string | null;
		isSubmitting?: boolean;
		onDiscard: () => void;
		onSubmit: () => void;
	}

	let {
		counts,
		coverage,
		coverageLoading = false,
		mode = 'submit',
		suggestionId = null,
		revision = null,
		hasUnsavedEdits = true,
		disabledReason = null,
		isSubmitting = false,
		onDiscard,
		onSubmit
	}: Props = $props();

	let saveMode = $derived(mode === 'save' && suggestionId !== null);
	let total = $derived(counts.create + counts.update + counts.delete);
	let disabled = $derived(
		total === 0 || disabledReason !== null || (saveMode && !hasUnsavedEdits)
	);
</script>

<div
	class="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
>
	<div class="flex flex-wrap items-center gap-3">
		{#if saveMode}
			<Badge variant="accent">Vorschlag #{suggestionId}{revision ? ` · Revision ${revision}` : ''}</Badge>
		{:else}
			<Badge variant="accent">Entwurf</Badge>
		{/if}

		<ChangeChips {counts} />

		{#if coverageLoading}
			<span class="flex items-center gap-2 text-xs text-text-tertiary">
				<Spinner size="sm" />
				Abdeckung wird berechnet …
			</span>
		{:else}
			<CoverageDelta {coverage} size="sm" />
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		{#if disabledReason}
			<span class="text-xs text-warning">{disabledReason}</span>
		{:else if saveMode}
			<span class="text-xs {hasUnsavedEdits ? 'font-medium text-accent' : 'text-text-tertiary'}">
				{hasUnsavedEdits ? 'Ungespeicherte Änderungen' : 'Keine ungespeicherten Änderungen'}
			</span>
		{/if}
		{#if saveMode}
			<a href="/suggestions/{suggestionId}" class="btn btn-ghost btn-sm">Zum Vorschlag</a>
		{/if}
		<Button variant="ghost" size="sm" onclick={onDiscard}>
			{saveMode ? 'Bearbeitung beenden' : 'Verwerfen'}
		</Button>
		<Button variant="primary" size="sm" {disabled} loading={isSubmitting} onclick={onSubmit}>
			{mode === 'save' ? 'Änderungen speichern' : 'Vorschlag einreichen'}
		</Button>
	</div>
</div>
