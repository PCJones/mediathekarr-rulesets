<script lang="ts">
	import type { Ruleset } from '$types';

	interface Props {
		ruleset: Ruleset;
		isSelected?: boolean;
		onEdit: () => void;
		onDelete: () => void;
		onDuplicate: () => void;
	}

	let { ruleset, isSelected = false, onEdit, onDelete, onDuplicate }: Props = $props();

	// Get strategy display label
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

	// Get filter summary
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
	class="card bg-base-100 border-2 cursor-pointer transition-all hover:shadow-md"
	class:border-primary={isSelected}
	class:ring-2={isSelected}
	class:ring-primary={isSelected}
	class:border-base-300={!isSelected}
	onclick={onEdit}
	role="button"
	tabindex="0"
	onkeypress={(e) => e.key === 'Enter' && onEdit()}
>
	<div class="card-body p-4">
		<div class="flex justify-between items-start gap-2">
			<div class="flex-1 min-w-0">
				<h3 class="font-bold truncate">{ruleset.topic || 'Ohne Topic'}</h3>
				<div class="flex flex-wrap gap-2 mt-2">
					<span class="badge badge-sm badge-outline">Prio: {ruleset.priority}</span>
					<span class="badge badge-sm badge-primary">{getStrategyLabel(ruleset.matchingStrategy)}</span>
				</div>
			</div>

			<!-- Actions dropdown -->
			<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
			<div class="dropdown dropdown-end" onclick={(e) => e.stopPropagation()}>
				<button tabindex="0" class="btn btn-ghost btn-xs btn-circle" aria-label="Aktionen">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
					</svg>
				</button>
				<ul class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-36 z-10" role="menu">
					<li><button onclick={onEdit}>Bearbeiten</button></li>
					<li><button onclick={onDuplicate}>Duplizieren</button></li>
					<li><button class="text-error" onclick={onDelete}>Löschen</button></li>
				</ul>
			</div>
		</div>

		<p class="text-xs text-base-content/60 mt-2 truncate">
			{getFilterSummary(ruleset.filters)}
		</p>

		{#if ruleset.titleRegexRules && ruleset.titleRegexRules.length > 0}
			<p class="text-xs text-base-content/50 mt-1">
				{ruleset.titleRegexRules.length} Titel-Regel{ruleset.titleRegexRules.length !== 1 ? 'n' : ''}
			</p>
		{/if}
	</div>
</div>
