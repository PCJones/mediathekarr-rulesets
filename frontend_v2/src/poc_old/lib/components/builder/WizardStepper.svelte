<script lang="ts">
	import type { WizardStep } from '$stores/ruleset';

	interface Props {
		steps: WizardStep[];
		currentStep: number;
		onStepClick: (index: number) => void;
	}

	let { steps, currentStep, onStepClick }: Props = $props();

	function getStepStatus(index: number): 'completed' | 'current' | 'upcoming' {
		if (index < currentStep) return 'completed';
		if (index === currentStep) return 'current';
		return 'upcoming';
	}
</script>

<div class="stepper-container">
	<ul class="steps steps-horizontal w-full">
		{#each steps as step, index}
			{@const status = getStepStatus(index)}
			<li
				class="step"
				class:step-primary={status === 'completed' || status === 'current'}
				class:cursor-pointer={index <= currentStep + 1}
				class:opacity-50={status === 'upcoming' && index > currentStep + 1}
				onclick={() => onStepClick(index)}
				data-content={status === 'completed' ? '✓' : index + 1}
			>
				<div class="step-label hidden md:block text-xs text-center mt-1">
					<span class="font-medium" class:text-primary={status === 'current'}>
						{step.label}
					</span>
					{#if step.isOptional}
						<span class="text-base-content/50 block">(optional)</span>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	<!-- Mobile: show current step info -->
	<div class="md:hidden mt-4 text-center">
		<div class="badge badge-primary badge-lg">
			Schritt {currentStep + 1} von {steps.length}
		</div>
		<h3 class="font-bold mt-2">{steps[currentStep]?.label}</h3>
		<p class="text-sm text-base-content/70">{steps[currentStep]?.description}</p>
	</div>
</div>

<style>
	.step-label {
		max-width: 100px;
		margin: 0 auto;
	}

	/* Override DaisyUI step styling for better clickability */
	.step {
		transition: opacity 0.2s ease;
	}

	.step.cursor-pointer:hover .step-label {
		text-decoration: underline;
	}
</style>
