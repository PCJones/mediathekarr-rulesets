<script lang="ts">
	import { setContext } from 'svelte';
	import { rulesetStore, wizardStore, wizardSteps, isRulesetValid } from '$stores/ruleset';
	import { previewStore } from '$stores/preview';
	import WizardStepper from './WizardStepper.svelte';
	import LivePreviewPanel from './LivePreviewPanel.svelte';
	import TopicEditor from './steps/TopicEditor.svelte';
	import FilterEditor from './steps/FilterEditor.svelte';
	import StrategyPicker from './steps/StrategyPicker.svelte';
	import TitleRulesEditor from './steps/TitleRulesEditor.svelte';
	import SeasonEpisodeEditor from './steps/SeasonEpisodeEditor.svelte';
	import TestAndSave from './steps/TestAndSave.svelte';
	import type { Ruleset, Media, DurationInfo, TvdbShowData } from '$types';

	// Props
	interface Props {
		/** Existing ruleset to edit (optional) */
		existingRuleset?: Ruleset;
		/** Media this ruleset belongs to (required) */
		media: Media;
		/** Duration info from TVDB (optional) */
		durationInfo?: DurationInfo | null;
		/** Full TVDB show data including episodes (optional) */
		tvdbShowData?: TvdbShowData | null;
		/** Callback when saving */
		onSave: (data: Omit<Ruleset, 'id'>) => Promise<void>;
		/** Callback when canceling */
		onCancel: () => void;
		/** Whether cancel is allowed (shows/hides button) */
		canCancel?: boolean;
	}

	let { existingRuleset, media, durationInfo = null, tvdbShowData = null, onSave, onCancel, canCancel = true }: Props = $props();

	// Provide callbacks via context for TestAndSave step
	// Using getters to capture current values (not initial values)
	setContext('wizardCallbacks', {
		get onSave() { return onSave; },
		get onCancel() { return onCancel; },
		get media() { return media; },
		get durationInfo() { return durationInfo; },
		get tvdbShowData() { return tvdbShowData; }
	});

	// Initialize store with existing ruleset if editing, or with media data if creating
	$effect(() => {
		// Clear preview when starting any wizard session - preview data is tied to ruleset
		previewStore.clear();

		if (existingRuleset) {
			rulesetStore.loadRuleset(existingRuleset);
			wizardStore.startEditing(existingRuleset.id!);
		} else {
			rulesetStore.reset();
			rulesetStore.initWithMedia(media);
			wizardStore.startCreating();
		}
	});

	// Reference to stepper element for scroll alignment
	let stepperElement: HTMLElement;

	// Current step from store
	let currentStep = $derived($wizardStore.currentStep);
	let steps = $derived($wizardSteps);
	let canGoNext = $derived(steps[currentStep]?.isValid || steps[currentStep]?.isOptional);
	let canGoPrev = $derived(currentStep > 0);
	let isLastStep = $derived(currentStep === steps.length - 1);

	// Steps that can be auto-skipped when optional (Titel-Regeln and Season/Episode)
	const skippableStepIds = ['titleRules', 'seasonEpisode'];

	// Find next step, skipping optional skippable steps
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

	// Find previous step, skipping optional skippable steps
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

	// Scroll to align stepper at top of viewport
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
		// Allow clicking on any step that is completed or the next one
		if (index <= currentStep || (index === currentStep + 1 && canGoNext)) {
			wizardStore.goToStep(index);
			scrollToStepper();
		}
	}
</script>

<div class="wizard-container">
	<!-- Goal statement header -->
	<div class="goal-header alert bg-base-100 border border-base-300 mb-6">
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2 text-lg font-bold">
				<span class="text-xl">🎯</span>
				<span>Ziel: MediathekViewWeb-Ergebnisse → TVDB-Episoden zuordnen</span>
			</div>
			<p class="text-base-content/70 text-sm">
				Dieses Ruleset definiert, wie Suchergebnisse von MediathekViewWeb den korrekten Episoden auf TheTVDB zugeordnet werden.
			</p>
		</div>
	</div>

	<!-- Stepper navigation -->
	<div bind:this={stepperElement}>
		<WizardStepper
			{steps}
			{currentStep}
			onStepClick={handleStepClick}
		/>
	</div>

	<!-- Step-specific alerts shown above content -->
	{#if currentStep === 2 && tvdbShowData}
		<div class="mt-6 space-y-4">
			<div class="alert alert-warning">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<div>
					<h4 class="font-bold">Die Strategie muss zur TVDB-Struktur passen!</h4>
					<p class="text-sm mt-1">
						Ein auslesen von der Staffel/Episodennummer bringt nichts, wenn TVDB die Episoden anders nummeriert als die Mediathek.
						Prüfe zuerst die TVDB-Daten unten.
					</p>
					<p class="text-sm mt-2">
						Falls TVDB-Daten komplett falsch oder nicht vollständig sind →
						<a
							href="https://www.thetvdb.com/?tab=series&id={tvdbShowData.id}"
							target="_blank"
							rel="noopener noreferrer"
							class="link link-primary"
						>
							Erst auf TVDB korrigieren!
						</a>
						<span class="text-base-content/60">(Änderungen können bis zu 72 Stunden dauern)</span>
					</p>
				</div>
			</div>

			<div class="alert">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<span class="text-sm">
					<strong>Tipp:</strong> Manchmal ist es nicht möglich, alle Titel-Varianten mit einem einzigen Ruleset abzudecken.
					In solchen Fällen können mehrere Rulesets für dieselbe Serie erstellt werden.
				</span>
			</div>
		</div>
	{/if}

	<!-- Step content - two column layout for steps 0-4, full width for step 5 -->
	{#if currentStep < 5}
		<div class="wizard-content grid grid-cols-1 lg:grid-cols-[minmax(420px,5fr)_minmax(0,8fr)] gap-6 mt-6">
			<!-- Left: Step controls -->
			<div class="step-controls card bg-base-200 shadow-lg">
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

			<!-- Right: Always-visible preview -->
			<div class="preview-wrapper">
				<div class="preview-column card bg-base-200 shadow-lg">
					<div class="card-body p-4">
						<LivePreviewPanel />
					</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Step 5 (TestAndSave): Full width, no preview needed -->
		<div class="wizard-content card bg-base-200 shadow-lg mt-6">
			<div class="card-body">
				<TestAndSave />
			</div>
		</div>
	{/if}

	<!-- Navigation buttons -->
	<div class="wizard-nav flex justify-between mt-6">
		{#if canCancel}
			<button
				class="btn btn-outline"
				onclick={onCancel}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
				</svg>
				Abbrechen
			</button>
		{:else}
			<div></div>
		{/if}

		<div class="flex gap-2">
			{#if canGoPrev}
				<button
					class="btn btn-outline"
					onclick={handlePrev}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
					Zurück
				</button>
			{/if}

			{#if !isLastStep}
				<button
					class="btn btn-primary"
					onclick={handleNext}
					disabled={!canGoNext}
				>
					Weiter
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
					</svg>
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.wizard-container {
		width: 100%;
		margin: 0 auto;
	}

	/* Wrapper fills grid cell but doesn't contribute to row height calculation */
	.preview-wrapper {
		contain: size; /* Key: size is independent of content */
		position: relative;
		height: 100%; /* Fill the grid cell (determined by left column) */
	}

	.preview-column {
		position: sticky;
		top: 1rem;
		max-height: min(calc(100vh - 2rem), 100%); /* Don't exceed viewport OR wrapper */
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
