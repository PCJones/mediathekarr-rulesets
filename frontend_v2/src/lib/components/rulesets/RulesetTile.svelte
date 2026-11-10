<script lang="ts">
	import { strategyLabel, type Ruleset } from '$types';
	import type { ChangeOp } from '$types/suggestion';
	import Badge from '$components/ui/Badge.svelte';
	import Dropdown from '$components/ui/Dropdown.svelte';
	import Delta from '$components/suggestions/Delta.svelte';
	import OpBadge from '$components/suggestions/OpBadge.svelte';

	interface Props {
		ruleset: Ruleset;
		isSelected?: boolean;
		onEdit: () => void;
		onDelete: () => void;
		onDuplicate: () => void;
		canEdit?: boolean;
		/** 1-based position in the effective order; replaces the priority badge. */
		position?: number | null;
		/** Staged change operation, if any. */
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
	}

	let {
		ruleset,
		isSelected = false,
		onEdit,
		onDelete,
		onDuplicate,
		canEdit = true,
		position = null,
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
		onRebase
	}: Props = $props();

	let isDeleted = $derived(op === 'delete');
	let canOpen = $derived(!isDeleted && canEdit);

	let opBorder = $derived(
		!op
			? ''
			: stale
				? 'border-l-[3px] border-l-warning'
				: op === 'create'
					? 'border-l-[3px] border-l-success'
					: op === 'delete'
						? 'border-l-[3px] border-l-error'
						: 'border-l-[3px] border-l-info'
	);

	/** Hover must not repaint the op-coloured left border. */
	let hoverBorder = $derived(
		!canOpen
			? ''
			: op
				? 'hover:border-t-accent hover:border-r-accent hover:border-b-accent'
				: 'hover:border-accent'
	);


	function getFilterSummary(filters: Ruleset['filters']): string {
		if (!filters || filters.length === 0) return 'Keine Filter';
		return filters.map(f => {
			if (f.attribute === 'duration') {
				return `>${f.value} min`;
			}
			return `${f.attribute} ${f.type} "${f.value}"`;
		}).join(', ');
	}
</script>

<div
	class="card relative transition-colors {opBorder} {hoverBorder}"
	class:border-accent={isSelected}
	class:opacity-60={isDeleted}
>
	<div class="p-4">
		<div class="flex justify-between items-start gap-2">
			<div class="flex-1 min-w-0">
				<h3 class="font-semibold truncate flex items-center gap-1.5">
					{#if position !== null}
						<span class="font-mono tabular-nums text-text-tertiary text-sm shrink-0">{position}</span>
					{/if}
					{#if canOpen}
						<button
							type="button"
							class="tile-open truncate text-left font-semibold"
							onclick={onEdit}
						>
							{ruleset.topic || 'Ohne Topic'}
						</button>
					{:else}
						<span class="truncate" class:line-through={isDeleted}>{ruleset.topic || 'Ohne Topic'}</span>
					{/if}
				</h3>
				<div class="flex flex-wrap gap-1.5 mt-2">
					{#if op}
						<OpBadge {op} {stale} />
					{:else if position === null}
						<Badge size="sm">Prio: {ruleset.priority}</Badge>
					{/if}
					<Badge variant="accent" size="sm">{strategyLabel(ruleset.matchingStrategy, true)}</Badge>
					{#if proposals}
						<a href={proposals.href} class="relative z-10 inline-flex">
							<Badge variant="info" size="sm">{proposals.label}</Badge>
						</a>
					{/if}
				</div>
			</div>

			{#if canEdit && !isDeleted}
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

		<p class="text-xs text-text-tertiary mt-2 truncate">
			{getFilterSummary(ruleset.filters)}
		</p>

		{#if ruleset.titleRegexRules && ruleset.titleRegexRules.length > 0}
			<p class="text-xs text-text-tertiary mt-1">
				{ruleset.titleRegexRules.length} Titel-Regel{ruleset.titleRegexRules.length !== 1 ? 'n' : ''}
			</p>
		{/if}

		{#if matches}
			<p class="mt-2">
				<Delta before={matches.before} after={matches.after} label="" size="sm" />
				<span class="text-xs text-text-secondary">Treffer</span>
			</p>
		{/if}

		{#if onMoveUp || onMoveDown || onDiscard || onRebase}
			<div class="flex items-center justify-between gap-2 mt-3">
				<div class="flex gap-0.5">
					{#if onMoveUp && !isDeleted}
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
					{#if onMoveDown && !isDeleted}
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
				</div>

				<div class="flex items-center gap-2">
					{#if onRebase}
						<button
							type="button"
							class="btn btn-sm relative z-10 text-warning"
							onclick={() => onRebase?.()}
						>
							Basis aktualisieren
						</button>
					{/if}
					{#if onDiscard}
						<button
							type="button"
							class="btn btn-sm relative z-10"
							onclick={() => onDiscard?.()}
						>
							{discardLabel}
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.tile-open::after {
		content: '';
		position: absolute;
		inset: 0;
	}

	.tile-open:focus-visible {
		outline: none;
	}

	.tile-open:focus-visible::after {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
		border-radius: 0.5rem;
	}
</style>
