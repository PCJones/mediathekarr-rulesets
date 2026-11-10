<script lang="ts">
	import type { Snippet } from 'svelte';
	import { strategyLabel } from '$types/ruleset';
	import type { FailStage, SuggestionChange } from '$types/suggestion';
	import Badge from '$components/ui/Badge.svelte';
	import Delta from './Delta.svelte';
	import OpBadge from './OpBadge.svelte';
	import RulesetDiff from './RulesetDiff.svelte';

	interface Props {
		change: SuggestionChange;
		suggestionId: number;
		mediaId?: number | null;
		/** Author or admin on an open proposal — gets the edit deep link instead of the view one. */
		canEdit?: boolean;
		stale?: boolean;
		staleAction?: Snippet;
	}

	let {
		change,
		suggestionId,
		mediaId = null,
		canEdit = false,
		stale = false,
		staleAction
	}: Props = $props();

	const failLabels: Record<FailStage, string> = { title: 'Titel', tvdb: 'TVDB' };

	let body = $derived(change.ruleset ?? change.base?.ruleset ?? null);
	let topic = $derived(body?.topic ?? '–');
	let strategy = $derived(body ? strategyLabel(body.matchingStrategy, true) : null);

	let href = $derived(
		mediaId
			? `/media/${mediaId}/rulesets?${canEdit ? 'draft' : 'view'}=suggestion:${suggestionId}&change=${encodeURIComponent(change.key)}`
			: null
	);

	let snapshot = $derived(change.snapshot);
	let samples = $derived(change.snapshot?.samples ?? []);
	let showSamples = $state(false);
</script>

<div class="rounded-lg border border-border-strong bg-bg overflow-hidden">
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2 bg-surface border-b border-border text-sm">
		<OpBadge op={change.op} />
		{#if stale}
			<OpBadge op={change.op} stale />
		{/if}
		<span class="font-mono font-medium">{topic}</span>
		{#if strategy}
			<Badge size="sm">{strategy}</Badge>
		{/if}

		<span class="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary">
			{#if snapshot}
				{@const matched = snapshot.after.matchedByThis ?? snapshot.before.matchedByThis}
				<span
					title="Videos, die dieses Ruleset einer Episode zuordnet"
					class:text-warning={matched === 0}
				>
					<span class="font-mono tabular-nums" class:text-text={matched !== 0}>{matched ?? '–'}</span>
					Treffer
				</span>
				<span class="text-border-strong" aria-hidden="true">|</span>
				{#if snapshot.after.coveredByAny === snapshot.before.coveredByAny}
					<span>Zuordnung unverändert</span>
				{:else}
					<span title="Videos, denen irgendein Ruleset eine Episode zuordnet">
						<Delta
							label="Zugeordnet"
							before={snapshot.before.coveredByAny}
							after={snapshot.after.coveredByAny}
							size="sm"
						/>
					</span>
				{/if}
			{:else}
				<span>Keine Messdaten</span>
			{/if}
			{#if href}
				<span class="text-border-strong" aria-hidden="true">|</span>
				<a {href} target="_blank" rel="noopener" class="text-accent hover:underline">
					{canEdit ? 'Im Wizard öffnen' : 'Ansehen'} ↗
				</a>
			{/if}
		</span>
	</div>

	{#if stale}
		<div class="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-sm text-warning border-b border-border stale-strip">
			<span>Das Live-Ruleset wurde seit dieser Revision geändert.</span>
			{#if staleAction}{@render staleAction()}{/if}
		</div>
	{/if}

	<RulesetDiff op={change.op} base={change.base?.ruleset} ruleset={change.ruleset} omitHeaderFields />

	{#if samples.length > 0}
		<button
			type="button"
			class="block w-full border-t border-border py-1.5 pl-7 text-left text-xs text-text-secondary hover:text-text transition-colors"
			aria-expanded={showSamples}
			onclick={() => (showSamples = !showSamples)}
		>
			Beispiele ({samples.length}) {showSamples ? '▾' : '▸'}
		</button>
		{#if showSamples}
			<div class="overflow-x-auto border-t border-border">
				<table class="data-table">
					<thead>
						<tr>
							<th>Titel</th>
							<th>Konstruiert</th>
							<th>TVDB-Episode</th>
						</tr>
					</thead>
					<tbody>
						{#each samples as sample, index (index)}
							<tr class:sample-failed={sample.fail}>
								<td class="font-mono">{sample.title}</td>
								<td class="font-mono">{sample.constructed ?? '–'}</td>
								<td class="font-mono">
									<span class="inline-flex items-center gap-2">
										{sample.episode ?? '–'}
										{#if sample.fail}
											<Badge variant="error" size="sm">{failLabels[sample.fail]}</Badge>
										{/if}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>

<style>
	.stale-strip {
		background-color: color-mix(in srgb, var(--color-warning) 8%, transparent);
	}
	.data-table tbody tr.sample-failed {
		background-color: color-mix(in srgb, var(--color-error) 5%, transparent);
	}
</style>
