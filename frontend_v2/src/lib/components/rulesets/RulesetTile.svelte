<script lang="ts">
	import type { Ruleset } from '$types';
	import Badge from '$components/ui/Badge.svelte';
	import Dropdown from '$components/ui/Dropdown.svelte';

	interface Props {
		ruleset: Ruleset;
		isSelected?: boolean;
		onEdit: () => void;
		onDelete: () => void;
		onDuplicate: () => void;
		canEdit?: boolean;
	}

	let { ruleset, isSelected = false, onEdit, onDelete, onDuplicate, canEdit = true }: Props = $props();

	function getStrategyLabel(strategy: string): string {
		const labels: Record<string, string> = {
			'SeasonAndEpisodeNumber': 'S+E',
			'AbsoluteEpisodeNumber': 'Absolut',
			'ByAbsoluteEpisodeNumber': 'Absolut (alt)',
			'ItemTitleIncludes': 'Titel enthält',
			'ItemTitleExact': 'Titel exakt',
			'ItemTitleEqualsAirdate': 'Datum'
		};
		return labels[strategy] || strategy;
	}

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

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
	class="card cursor-pointer transition-colors hover:border-accent"
	class:border-accent={isSelected}
	onclick={onEdit}
	role="button"
	tabindex="0"
	onkeypress={(e) => e.key === 'Enter' && onEdit()}
>
	<div class="p-4">
		<div class="flex justify-between items-start gap-2">
			<div class="flex-1 min-w-0">
				<h3 class="font-semibold truncate">{ruleset.topic || 'Ohne Topic'}</h3>
				<div class="flex flex-wrap gap-1.5 mt-2">
					<Badge size="sm">Prio: {ruleset.priority}</Badge>
					<Badge variant="accent" size="sm">{getStrategyLabel(ruleset.matchingStrategy)}</Badge>
				</div>
			</div>

			{#if canEdit}
			<Dropdown align="right">
				{#snippet trigger()}
					<button
						class="rounded-full p-1 text-text-tertiary hover:bg-surface-raised hover:text-text"
						aria-label="Aktionen"
						onclick={(e) => e.stopPropagation()}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
							<path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
						</svg>
					</button>
				{/snippet}
				{#snippet children()}
					<button class="w-full px-3 py-2 text-left text-sm hover:bg-surface-raised" onclick={onEdit}>Bearbeiten</button>
					<button class="w-full px-3 py-2 text-left text-sm hover:bg-surface-raised" onclick={onDuplicate}>Duplizieren</button>
					<button class="w-full px-3 py-2 text-left text-sm text-error hover:bg-surface-raised" onclick={onDelete}>Löschen</button>
				{/snippet}
			</Dropdown>
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
	</div>
</div>
