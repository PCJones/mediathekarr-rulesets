<script lang="ts">
	import { strategyLabel, type Ruleset } from '$types';
	import { formatFilter, splitCaptureGroups, type Facet } from '$utils/rulesetFacets';

	interface Props {
		ruleset: Ruleset;
		facet: Facet;
		/** Larger patterns for the per-row columns. */
		prominent?: boolean;
	}

	let { ruleset, facet, prominent = false }: Props = $props();

	let rules = $derived(ruleset.titleRegexRules ?? []);
	let filters = $derived(ruleset.filters ?? []);
</script>

{#snippet pattern(source: string)}
	<code class="pattern" class:prominent>{#each splitCaptureGroups(source) as part, i (i)}{#if part.group}<span class="group-capture">{part.text}</span>{:else}{part.text}{/if}{/each}</code>
{/snippet}

{#if facet === 'topic'}
	<span class="break-words">{ruleset.topic ? ruleset.topic.split('|').join(' · ') : 'Ohne Topic'}</span>
{:else if facet === 'strategy'}
	<span class="whitespace-nowrap">{strategyLabel(ruleset.matchingStrategy, true)}</span>
{:else if facet === 'extraction'}
	{#if ruleset.seasonRegex || ruleset.episodeRegex}
		<span class="inline-flex flex-wrap items-baseline gap-x-4 gap-y-1">
			{#if ruleset.seasonRegex}
				<span class="inline-flex items-baseline gap-1.5"><span class="key">S</span>{@render pattern(ruleset.seasonRegex)}</span>
			{/if}
			{#if ruleset.episodeRegex}
				<span class="inline-flex items-baseline gap-1.5"><span class="key">E</span>{@render pattern(ruleset.episodeRegex)}</span>
			{/if}
		</span>
	{:else}
		<span class="text-text-tertiary">–</span>
	{/if}
{:else if facet === 'titleRules'}
	{#if rules.length}
		<span class="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
			{#each rules as rule, i}
				{#if i > 0}<span class="text-text-tertiary">+</span>{/if}
				{#if rule.type === 'static'}
					<code class="pattern" class:prominent>"{rule.value ?? ''}"</code>
				{:else}
					<span class="inline-flex items-baseline gap-1.5"><span class="key">{rule.field ?? 'title'}</span>{@render pattern(rule.pattern ?? '')}</span>
				{/if}
			{/each}
		</span>
	{:else}
		<span class="text-text-tertiary">–</span>
	{/if}
{:else if facet === 'filters'}
	<span class="whitespace-nowrap">{filters.length ? filters.map(formatFilter).join(', ') : 'Keine Filter'}</span>
{/if}

<style>
	.key {
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--color-text-tertiary);
	}

	.pattern {
		font-size: 0.8125rem;
		color: var(--color-text);
		word-break: break-all;
	}

	.pattern.prominent {
		font-size: 0.9375rem;
	}

	.group-capture {
		color: var(--color-accent);
		font-weight: 600;
	}
</style>
