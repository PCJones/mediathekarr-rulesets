<script lang="ts">
	import {
		coverageStore,
		simulatedRulesets,
		hasSimulationChanges,
		NEW_RULESET_SENTINEL_ID
	} from '$stores/coverage';
	import { updateRuleset } from '$api/rulesets';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';

	interface Props {
		currentRulesetId: number | undefined;
	}

	let { currentRulesetId }: Props = $props();

	let isSaving = $state(false);
	let saveError = $state<string | null>(null);

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
		saveError = null;
	}

	async function handleSavePriorities() {
		isSaving = true;
		saveError = null;

		try {
			const changed: Array<{ id: number; priority: number }> = [];
			for (const sim of rulesets) {
				// Skip new (unsaved) rulesets — they have no server-side ID
				if (sim.id === NEW_RULESET_SENTINEL_ID) continue;
				if (sim.simulatedPriority !== sim.ruleset.priority) {
					changed.push({ id: sim.id, priority: sim.simulatedPriority });
				}
			}

			// Save all changed priorities in parallel
			await Promise.all(
				changed.map(({ id, priority }) => updateRuleset(id, { priority }))
			);

			// Update local state so hasSimulationChanges resets correctly
			coverageStore.applyPriorityChanges(changed);
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Fehler beim Speichern';
		} finally {
			isSaving = false;
		}
	}

	function getStrategyLabel(strategy: string): string {
		const labels: Record<string, string> = {
			'SeasonAndEpisodeNumber': 'S+E',
			'AbsoluteEpisodeNumber': 'Abs',
			'ByAbsoluteEpisodeNumber': 'Abs',
			'ItemTitleIncludes': 'Titel~',
			'ItemTitleExact': 'Titel=',
			'ItemTitleEqualsAirdate': 'Datum'
		};
		return labels[strategy] || strategy;
	}
</script>

<div class="coverage-simulator">
	{#if rulesets.length === 0}
		<p class="text-text-tertiary text-xs">Keine Rulesets vorhanden.</p>
	{:else}
		<div class="flex flex-col gap-1.5">
			{#each rulesets as sim, idx}
				{@const isCurrent = sim.id === currentRulesetId}
			{@const isNew = sim.id === NEW_RULESET_SENTINEL_ID}
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

					<!-- Ruleset info -->
					<div class="flex-1 min-w-0 flex items-center gap-1.5">
						<span class="simulator-label truncate" title={sim.ruleset.topic}>
							{sim.ruleset.topic}
						</span>
						{#if isCurrent}
							<Badge variant="accent" size="sm">{isNew ? 'neu' : 'aktuell'}</Badge>
						{/if}
					</div>

					<!-- Strategy badge -->
					<Badge size="sm">{getStrategyLabel(sim.ruleset.matchingStrategy)}</Badge>

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
								<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293 3.293a1 1 0 01-1.414-1.414l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
							</svg>
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Actions -->
		{#if hasChanges || saveError}
			<div class="mt-3 flex flex-col gap-2">
				{#if saveError}
					<div class="text-error text-xs">{saveError}</div>
				{/if}
				<div class="flex gap-2">
					{#if hasChanges}
						<Button size="sm" variant="primary" onclick={handleSavePriorities} loading={isSaving}>
							Prioritäten speichern
						</Button>
						<Button size="sm" onclick={handleReset}>
							Zurücksetzen
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
