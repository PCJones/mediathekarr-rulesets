<script lang="ts">
	import type { Ruleset } from '$types';
	import type { ChangeOp } from '$types/suggestion';
	import { FACET_LABELS, type Facet } from '$utils/rulesetFacets';
	import Badge from '$components/ui/Badge.svelte';
	import Dropdown from '$components/ui/Dropdown.svelte';
	import Delta from '$components/suggestions/Delta.svelte';
	import OpBadge from '$components/suggestions/OpBadge.svelte';
	import RulesetFacet from './RulesetFacet.svelte';

	interface Props {
		ruleset: Ruleset;
		/** Facets shown as columns; shared ones are rendered once above the list. */
		facets: Facet[];
		/** 1-based position in the effective order. */
		position: number;
		onEdit: () => void;
		onDelete: () => void;
		onDuplicate: () => void;
		canEdit?: boolean;
		op?: ChangeOp | null;
		stale?: boolean;
		matches?: { before: number | null; after: number | null } | null;
		proposals?: { label: string; href: string } | null;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		onMoveUp?: () => void;
		onMoveDown?: () => void;
		onDiscard?: () => void;
		discardLabel?: string;
		onRebase?: () => void;
		/** Distinct episodes this ruleset recognises first; null while unknown. */
		coverage?: {
			found: number;
			unknown: number;
			shadowedBy: { position: number; count: number }[];
		} | null;
		/** Largest `found` in the list, scales the bar. */
		coverageMax?: number;
		coverageLoading?: boolean;
	}

	let {
		ruleset,
		facets,
		position,
		onEdit,
		onDelete,
		onDuplicate,
		canEdit = true,
		op = null,
		stale = false,
		matches = null,
		proposals = null,
		canMoveUp = false,
		canMoveDown = false,
		onMoveUp,
		onMoveDown,
		onDiscard,
		discardLabel = 'Änderung verwerfen',
		onRebase,
		coverage = null,
		coverageMax = 0,
		coverageLoading = false
	}: Props = $props();

	let barWidth = $derived(
		coverage?.found && coverageMax ? Math.max((coverage.found / coverageMax) * 100, 3) : 0
	);

	let reasons = $derived.by(() => {
		if (!coverage) return [];
		const list: string[] = [];
		for (const { position, count } of coverage.shadowedBy) {
			list.push(`schon von #${position} erkannt (${count}×)`);
		}
		if (coverage.unknown > 0) {
			list.push(`Nummer erkannt, aber keine TVDB-Folge (${coverage.unknown}×)`);
		}
		if (list.length === 0 && coverage.found === 0) list.push('passt auf keinen Titel');
		return list;
	});

	let isDeleted = $derived(op === 'delete');
	let canOpen = $derived(!isDeleted && canEdit);

	let opMarker = $derived(
		!op
			? ''
			: stale
				? 'shadow-[inset_3px_0_0_var(--color-warning)]'
				: op === 'create'
					? 'shadow-[inset_3px_0_0_var(--color-success)]'
					: op === 'delete'
						? 'shadow-[inset_3px_0_0_var(--color-error)]'
						: 'shadow-[inset_3px_0_0_var(--color-info)]'
	);
</script>

<div
	class="ruleset-row relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 transition-colors last:rounded-b-lg md:col-span-full md:grid md:grid-cols-subgrid {opMarker} {canOpen ? 'hover:bg-surface-raised' : ''}"
	class:opacity-60={isDeleted}
>
	{#if canOpen}
		<button
			type="button"
			class="row-open absolute inset-0"
			aria-label="Ruleset {position} bearbeiten"
			onclick={onEdit}
		></button>
	{/if}

	<span class="w-6 text-right font-mono text-base tabular-nums text-text-tertiary">{position}</span>

	{#each facets as facet (facet)}
		<div
			class="min-w-0 {facet === 'extraction' || facet === 'titleRules'
				? 'basis-full md:basis-auto'
				: 'text-sm font-medium text-text'}"
			class:line-through={isDeleted}
		>
			{#if facets.length > 1}
				<span class="mr-1.5 text-xs text-text-tertiary md:hidden">{FACET_LABELS[facet]}</span>
			{/if}
			<RulesetFacet {ruleset} {facet} prominent />
		</div>
	{:else}
		<span class="text-sm text-text-tertiary">Keine Unterschiede</span>
	{/each}

	<div class="flex min-w-0 flex-col items-end gap-0.5">
		{#if coverage}
			<div class="flex items-center gap-2.5">
				<span class="h-1.5 w-28 overflow-hidden rounded-full bg-border">
					<span class="block h-full rounded-full bg-accent" style:width="{barWidth}%"></span>
				</span>
				<span class="w-20 text-right text-sm text-text-secondary">
					<span
						class="font-mono font-medium tabular-nums {coverage.found === 0
							? 'text-warning'
							: 'text-text'}">{coverage.found}</span
					>
					{coverage.found === 1 ? 'Folge' : 'Folgen'}
				</span>
			</div>
			{#if reasons.length > 0}
				<span class="text-right text-xs text-text-tertiary">{reasons.join(' · ')}</span>
			{/if}
		{:else if coverageLoading}
			<div class="flex items-center gap-2.5">
				<span class="h-1.5 w-28 animate-pulse rounded-full bg-border"></span>
				<span class="w-20"></span>
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-center justify-end gap-2">
		{#if op}
			<OpBadge {op} {stale} />
		{/if}
		{#if proposals}
			<a href={proposals.href} class="relative z-10 inline-flex">
				<Badge variant="info" size="sm">{proposals.label}</Badge>
			</a>
		{/if}
		{#if matches}
			<span class="whitespace-nowrap">
				<Delta before={matches.before} after={matches.after} label="" size="sm" />
				<span class="text-xs text-text-secondary">Treffer</span>
			</span>
		{/if}
		{#if onRebase}
			<button type="button" class="btn btn-sm relative z-10 text-warning" onclick={() => onRebase?.()}>
				Basis aktualisieren
			</button>
		{/if}
		{#if onDiscard}
			<button type="button" class="btn btn-sm relative z-10" onclick={() => onDiscard?.()}>
				{discardLabel}
			</button>
		{/if}
	</div>

	<div
		class="row-controls ml-auto flex items-center gap-0.5 transition-opacity md:ml-0"
	>
		{#if canEdit && !isDeleted}
			{#if onMoveUp}
				<button
					type="button"
					class="btn btn-ghost btn-icon btn-sm relative z-10"
					disabled={!canMoveUp}
					onclick={() => onMoveUp?.()}
					title="Höhere Priorität"
					aria-label="Höhere Priorität"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			{/if}
			{#if onMoveDown}
				<button
					type="button"
					class="btn btn-ghost btn-icon btn-sm relative z-10"
					disabled={!canMoveDown}
					onclick={() => onMoveDown?.()}
					title="Niedrigere Priorität"
					aria-label="Niedrigere Priorität"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			{/if}
			<div class="relative z-20">
				<Dropdown align="right">
					{#snippet trigger()}
						<span class="inline-flex rounded-full p-1 text-text-tertiary hover:bg-surface-raised hover:text-text">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
								<path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
							</svg>
						</span>
						<span class="sr-only">Aktionen</span>
					{/snippet}
					{#snippet children()}
						<button class="w-full px-3 py-2 text-left text-sm hover:bg-surface-raised" onclick={onEdit}>Bearbeiten</button>
						<button class="w-full px-3 py-2 text-left text-sm hover:bg-surface-raised" onclick={onDuplicate}>Duplizieren</button>
						<button class="w-full px-3 py-2 text-left text-sm text-error hover:bg-surface-raised" onclick={onDelete}>Löschen</button>
					{/snippet}
				</Dropdown>
			</div>
		{/if}
	</div>
</div>

<style>
	@media (hover: hover) {
		.row-controls {
			opacity: 0.35;
		}

		.ruleset-row:hover .row-controls,
		.ruleset-row:focus-within .row-controls {
			opacity: 1;
		}
	}

	.row-open:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}
</style>
