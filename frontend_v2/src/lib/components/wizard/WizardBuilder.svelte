<script lang="ts">
	import { setContext, onDestroy } from 'svelte';
	import { untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { rulesetStore, wizardStore, wizardSteps, isRulesetValid } from '$stores/ruleset';
	import { previewStore } from '$stores/preview';
	import { coverageStore, currentSimulatedPriority } from '$stores/coverage';
	import { getRulesetsForMedia } from '$api/rulesets';
	import WizardBreadcrumb from './WizardBreadcrumb.svelte';
	import LivePreviewPanel from './LivePreviewPanel.svelte';
	import TopicEditor from './steps/TopicEditor.svelte';
	import FilterEditor from './steps/FilterEditor.svelte';
	import StrategyPicker from './steps/StrategyPicker.svelte';
	import TitleRulesEditor from './steps/TitleRulesEditor.svelte';
	import SeasonEpisodeEditor from './steps/SeasonEpisodeEditor.svelte';
	import TestAndSave from './steps/TestAndSave.svelte';
	import Button from '$components/ui/Button.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import type { Ruleset, Media, DurationInfo, TvdbShowData } from '$types';

	interface Props {
		existingRuleset?: Ruleset;
		media: Media;
		durationInfo?: DurationInfo | null;
		tvdbShowData?: TvdbShowData | null;
		onSave: (data: Omit<Ruleset, 'id'>) => Promise<void>;
		onCancel: () => void;
		canCancel?: boolean;
	}

	let { existingRuleset, media, durationInfo = null, tvdbShowData = null, onSave, onCancel, canCancel = true }: Props = $props();

	// Provide callbacks via context for step components
	setContext('wizardCallbacks', {
		get onSave() { return onSave; },
		get onCancel() { return onCancel; },
		get media() { return media; },
		get durationInfo() { return durationInfo; },
		get tvdbShowData() { return tvdbShowData; }
	});

	// Initialize stores (run once, not on every reactive change)
	let initialized = false;
	$effect(() => {
		if (initialized) return;
		initialized = true;

		untrack(() => {
			previewStore.clear();

			if (existingRuleset) {
				rulesetStore.loadRuleset(existingRuleset);
				wizardStore.startEditing(existingRuleset.id!);
			} else {
				rulesetStore.reset();
				rulesetStore.initWithMedia(media);
				wizardStore.startCreating();
			}

			// Load all rulesets for coverage evaluation (including current)
			loadAllRulesets();

			// Set TVDB episodes for full-pipeline matching
			coverageStore.setTvdbEpisodes(tvdbShowData?.episodes || []);

			// Set current ruleset info so simulator knows which one is being edited
			coverageStore.setCurrentRuleset(existingRuleset?.id);
		});
	});

	// Reactively sync current ruleset data into the coverage simulator
	// This keeps the "aktuell" entry updated as the user edits topic, filters, strategy, etc.
	$effect(() => {
		const currentData = $rulesetStore;
		untrack(() => {
			coverageStore.setCurrentRulesetEntry(currentData, existingRuleset?.id);
		});
	});

	// Sync the simulated priority of the entry being edited back into rulesetStore so
	// that saving the wizard persists the priority chosen in the simulator (e.g. a new
	// ruleset's "lowest priority by default" or a manual reorder).
	// Skip when the simulation has not yet populated the entry — currentSimulatedPriority
	// falls back to 0, which would otherwise clobber the loaded ruleset's real priority.
	$effect(() => {
		const simPriority = $currentSimulatedPriority;
		const cov = get(coverageStore);
		const id = cov.currentRulesetId;
		if (id == null || !cov.simulation.has(id)) return;
		if (get(rulesetStore).priority !== simPriority) {
			rulesetStore.setPriority(simPriority);
		}
	});

	// Cleanup coverage store on unmount
	onDestroy(() => {
		coverageStore.clear();
	});

	async function loadAllRulesets() {
		try {
			const allRulesets = await getRulesetsForMedia(media.id);
			coverageStore.setAllRulesets(allRulesets);
		} catch {
			// coverage simulator falls back to the current draft only
		}
	}

	let stepperElement: HTMLElement;
	let currentStep = $derived($wizardStore.currentStep);
	let steps = $derived($wizardSteps);
	let canGoNext = $derived(steps[currentStep]?.isValid || steps[currentStep]?.isOptional);
	let canGoPrev = $derived(currentStep > 0);
	let isLastStep = $derived(currentStep === steps.length - 1);

	const skippableStepIds = ['titleRules', 'seasonEpisode'];

	function findNextStep(fromStep: number): number {
		let next = fromStep + 1;
		while (next < steps.length - 1) {
			const step = steps[next];
			if (skippableStepIds.includes(step.id) && step.isOptional) {
				next++;
			} else {
				break;
			}
		}
		return Math.min(next, steps.length - 1);
	}

	function findPrevStep(fromStep: number): number {
		let prev = fromStep - 1;
		while (prev > 0) {
			const step = steps[prev];
			if (skippableStepIds.includes(step.id) && step.isOptional) {
				prev--;
			} else {
				break;
			}
		}
		return Math.max(prev, 0);
	}

	function scrollToStepper() {
		stepperElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function handleNext() {
		if (canGoNext && !isLastStep) {
			const nextStep = findNextStep(currentStep);
			wizardStore.goToStep(nextStep);
			scrollToStepper();
		}
	}

	function handlePrev() {
		if (canGoPrev) {
			const prevStep = findPrevStep(currentStep);
			wizardStore.goToStep(prevStep);
			scrollToStepper();
		}
	}

	function handleStepClick(index: number) {
		if (index <= currentStep || (index === currentStep + 1 && canGoNext)) {
			wizardStore.goToStep(index);
			scrollToStepper();
		}
	}
</script>

<div class="wizard-container">
	<!-- Goal statement -->
	<div class="alert alert-info mb-6">
		<div>
			<div class="flex items-center gap-2 font-semibold">
				Ziel: MediathekViewWeb-Ergebnisse → TVDB-Episoden zuordnen
			</div>
			<p class="text-sm mt-1 opacity-80">
				Dieses Ruleset definiert, wie Suchergebnisse von MediathekViewWeb den korrekten Episoden auf TheTVDB zugeordnet werden.
			</p>
		</div>
	</div>

	<!-- Breadcrumb navigation -->
	<div bind:this={stepperElement}>
		<WizardBreadcrumb {steps} {currentStep} onStepClick={handleStepClick} />
	</div>

	<!-- Strategy step warnings -->
	{#if currentStep === 2 && tvdbShowData}
		<div class="mt-6 space-y-3">
			<Alert variant="warning">
				<div>
					<h4 class="font-semibold">Die Strategie muss zur TVDB-Struktur passen!</h4>
					<p class="text-sm mt-1">
						Ein Auslesen von Staffel/Episodennummer bringt nichts, wenn TVDB die Episoden anders nummeriert.
						Prüfe zuerst die TVDB-Daten unten.
					</p>
					<p class="text-sm mt-2">
						Falls TVDB-Daten falsch sind →
						<a
							href="https://www.thetvdb.com/?tab=series&id={tvdbShowData.id}"
							target="_blank"
							rel="noopener noreferrer"
							class="text-accent hover:underline"
						>
							Auf TVDB korrigieren
						</a>
						<span class="text-text-tertiary">(Änderungen dauern bis zu 72h)</span>
					</p>
				</div>
			</Alert>

			<Alert variant="info">
				<span class="text-sm">
					<strong>Tipp:</strong> Manchmal ist es nicht möglich, alle Titel-Varianten mit einem einzigen Ruleset abzudecken.
					In solchen Fällen können mehrere Rulesets für dieselbe Serie erstellt werden.
				</span>
			</Alert>
		</div>
	{/if}

	<!-- Step content -->
	{#if currentStep < 5}
		<div class="wizard-content grid grid-cols-1 lg:grid-cols-[minmax(420px,5fr)_minmax(0,8fr)] gap-6 mt-6">
			<!-- Left: Step editor -->
			<div class="card lg:min-h-[420px]">
				<div class="card-body">
					{#if currentStep === 0}
						<TopicEditor />
					{:else if currentStep === 1}
						<FilterEditor />
					{:else if currentStep === 2}
						<StrategyPicker />
					{:else if currentStep === 3}
						<TitleRulesEditor />
					{:else if currentStep === 4}
						<SeasonEpisodeEditor />
					{/if}
				</div>
			</div>

			<!-- Right: Preview -->
			<div class="preview-wrapper">
				<div class="preview-column card">
					<div class="card-body p-4">
						<LivePreviewPanel />
					</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Step 5 (TestAndSave): Full width -->
		<div class="card mt-6">
			<div class="card-body">
				<TestAndSave />
			</div>
		</div>
	{/if}

	<!-- Navigation buttons -->
	<div class="flex justify-between mt-6">
		{#if canCancel}
			<Button variant="ghost" onclick={onCancel}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
				</svg>
				Abbrechen
			</Button>
		{:else}
			<div></div>
		{/if}

		<div class="flex gap-2">
			{#if canGoPrev}
				<Button onclick={handlePrev}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
					Zurück
				</Button>
			{/if}

			{#if !isLastStep}
				<Button variant="primary" onclick={handleNext} disabled={!canGoNext}>
					Weiter
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
					</svg>
				</Button>
			{/if}
		</div>
	</div>
</div>

<style>
	.wizard-container {
		width: 100%;
		margin: 0 auto;
	}

	.preview-wrapper {
		contain: size;
		position: relative;
		height: 100%;
	}

	.preview-column {
		position: sticky;
		top: 1rem;
		max-height: min(calc(100vh - 2rem), 100%);
		display: flex;
		flex-direction: column;
	}

	.preview-column > :global(.card-body) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.preview-column :global(.live-preview-panel) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.preview-column :global(.live-preview-panel > .flex-1) {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
</style>
