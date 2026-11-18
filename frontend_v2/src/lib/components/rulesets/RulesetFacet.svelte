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
	<code class="pattern" class:prominent>{#each splitCaptureGroups(source) as part, partIndex (partIndex)}{#if partIndex > 0}<wbr />{/if}<span class="token" class:group-capture={part.group}>{part.text}</span>{/each}</code>
{/snippet}

{#if facet === 'topic'}
	<span class="break-words">{ruleset.topic ? ruleset.topic.split('|').join(' · ') : 'Ohne Topic'}</span>
{:else if facet === 'strategy'}
	<span class="whitespace-nowrap">{strategyLabel(ruleset.matchingStrategy, true)}</span>
{:else if facet === 'extraction'}
	{#if ruleset.seasonRegex || ruleset.episodeRegex}
		<span class="inline-flex min-w-0 max-w-full flex-col gap-1 align-top">
			{#if ruleset.seasonRegex}
				<span class="flex min-w-0 items-baseline gap-1.5"><span class="key">S</span>{@render pattern(ruleset.seasonRegex)}</span>
			{/if}
			{#if ruleset.episodeRegex}
				<span class="flex min-w-0 items-baseline gap-1.5"><span class="key">E</span>{@render pattern(ruleset.episodeRegex)}</span>
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
	{#if filters.length}
		<span>{#each filters as filter, filterIndex (filterIndex)}<span class="whitespace-nowrap">{formatFilter(filter)}{filterIndex < filters.length - 1 ? ',' : ''}</span>{filterIndex < filters.length - 1 ? ' ' : ''}{/each}</span>
	{:else}
		<span class="whitespace-nowrap">Keine Filter</span>
	{/if}
{/if}

<style>
	.key {
		flex-shrink: 0;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--color-text-tertiary);
	}

	.pattern {
		font-size: 0.8125rem;
		min-width: 0;
		color: var(--color-text);
	}

	/* A token moves to the next line as a whole; it only breaks inside when it alone is wider than the column. */
	.token {
		display: inline-block;
		max-width: 100%;
		/* Keeps the line baseline on the first line so the S/E key lines up with it. */
		vertical-align: top;
		overflow-wrap: anywhere;
	}

	.pattern.prominent {
		font-size: 0.9375rem;
	}

	.group-capture {
		color: var(--color-accent);
		font-weight: 600;
	}
</style>
