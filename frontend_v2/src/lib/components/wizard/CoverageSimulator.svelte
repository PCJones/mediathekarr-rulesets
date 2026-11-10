<script lang="ts">
	import { getContext } from 'svelte';
	import { coverageStore, simulatedRulesets, hasSimulationChanges } from '$stores/coverage';
	import { strategyLabel } from '$types';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';

	interface Props {
		currentRulesetId: number | undefined;
	}

	let { currentRulesetId }: Props = $props();

	const wizardCallbacks = getContext<{
		mode?: 'direct' | 'draft' | 'view';
	}>('wizardCallbacks');

	let mode = $derived(wizardCallbacks?.mode ?? 'direct');

	let rulesets = $derived($simulatedRulesets);
	let hasChanges = $derived($hasSimulationChanges);

	function handleToggle(id: number) {
		coverageStore.toggleRuleset(id);
	}

	function handleMoveUp(id: number) {
		coverageStore.moveRulesetUp(id);
	}

	function handleMoveDown(id: number) {
		coverageStore.moveRulesetDown(id);
	}

	function handleReset() {
		coverageStore.resetSimulation();
	}
</script>

<div class="coverage-simulator">
	{#if rulesets.length === 0}
		<p class="text-text-tertiary text-xs">Keine Rulesets vorhanden.</p>
	{:else}
		<div class="flex flex-col gap-1.5">
			{#each rulesets as sim, idx}
				{@const isCurrent = sim.id === currentRulesetId}
			{@const isNew = sim.id < 0}
				{@const isFirst = idx === 0}
				{@const isLast = idx === rulesets.length - 1}
				<div
					class="coverage-simulator-row"
					class:is-current={isCurrent}
					class:is-disabled={!sim.enabled}
				>
					<!-- Toggle checkbox -->
					<input
						type="checkbox"
						checked={sim.enabled}
						onchange={() => handleToggle(sim.id)}
						class="shrink-0"
						title={sim.enabled ? 'Deaktivieren' : 'Aktivieren'}
					/>

					<!-- Priority number -->
					<span class="font-mono text-xs text-text-tertiary w-5 text-center shrink-0">
						{sim.simulatedPriority}
					</span>

					<!-- Highest / lowest indicator -->
					{#if isFirst || isLast}
						<span class="priority-edge-label shrink-0" class:is-lowest={isLast && !isFirst}>
							{isFirst ? 'höchste' : 'niedrigste'}
						</span>
					{/if}

					<!-- Ruleset info -->
					<div class="flex-1 min-w-0 flex items-center gap-1.5">
						<span class="simulator-label truncate" title={sim.ruleset.topic}>
							{sim.ruleset.topic}
						</span>
						{#if isCurrent}
							<Badge variant="accent" size="sm">{isNew ? 'neu' : 'aktuell'}</Badge>
						{:else if isNew}
							<Badge variant="success" size="sm">Neu</Badge>
						{/if}
					</div>

					<!-- Strategy badge -->
					<Badge size="sm">{strategyLabel(sim.ruleset.matchingStrategy, true)}</Badge>

					<!-- Reorder buttons -->
					<div class="flex gap-0.5 shrink-0">
						<button
							type="button"
							class="btn btn-ghost btn-icon btn-sm"
							disabled={isFirst}
							onclick={() => handleMoveUp(sim.id)}
							title="Höhere Priorität (nach oben)"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
							</svg>
						</button>
						<button
							type="button"
							class="btn btn-ghost btn-icon btn-sm"
							disabled={isLast}
							onclick={() => handleMoveDown(sim.id)}
							title="Niedrigere Priorität (nach unten)"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
							</svg>
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Actions -->
		{#if mode !== 'view' && hasChanges}
			<div class="mt-3 flex gap-2">
				<Button size="sm" onclick={handleReset}>
					Zurücksetzen
				</Button>
			</div>
		{/if}
	{/if}
</div>
