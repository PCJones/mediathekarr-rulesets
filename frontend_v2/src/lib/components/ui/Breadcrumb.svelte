<script lang="ts">
	interface BreadcrumbStep {
		id: string;
		label: string;
		isOptional?: boolean;
	}

	interface Props {
		steps: BreadcrumbStep[];
		currentStep: number;
		onStepClick: (index: number) => void;
	}

	let { steps, currentStep, onStepClick }: Props = $props();

	function getStepStatus(index: number): 'completed' | 'current' | 'upcoming' {
		if (index < currentStep) return 'completed';
		if (index === currentStep) return 'current';
		return 'upcoming';
	}

	function isClickable(index: number): boolean {
		return index <= currentStep + 1;
	}
</script>

<nav class="breadcrumb-nav" aria-label="Wizard-Fortschritt">
	<!-- Desktop: full breadcrumb -->
	<div class="hidden md:flex items-center gap-0">
		{#each steps as step, index}
			{@const status = getStepStatus(index)}
			{@const clickable = isClickable(index)}

			{#if index > 0}
				<!-- Connecting line -->
				<div
					class="h-px flex-1 min-w-4 max-w-12 transition-colors"
					class:bg-accent={status === 'completed'}
					class:bg-text-tertiary={status !== 'completed'}
				></div>
			{/if}

			<button
				class="flex flex-col items-center gap-1 group"
				class:cursor-pointer={clickable}
				class:cursor-default={!clickable}
				class:opacity-40={!clickable}
				onclick={() => clickable && onStepClick(index)}
				disabled={!clickable}
				aria-label="Schritt {index + 1}: {step.label}"
				aria-current={status === 'current' ? 'step' : undefined}
			>
				<!-- Circle -->
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors"
					class:border-accent={status === 'current'}
					class:bg-accent={status === 'completed'}
					class:text-accent-text={status === 'completed'}
					class:text-accent={status === 'current'}
					class:border-text-tertiary={status === 'upcoming'}
					class:text-text-secondary={status === 'upcoming'}
				>
					{#if status === 'completed'}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
					{:else}
						{index + 1}
					{/if}
				</div>

				<!-- Label -->
				<span
					class="text-xs text-center max-w-[80px] leading-tight transition-colors"
					class:text-accent={status === 'current'}
					class:font-medium={status === 'current'}
					class:text-text-secondary={status === 'completed' || status === 'upcoming'}
				>
					{step.label}
					{#if step.isOptional}
						<span class="block text-[0.625rem] text-text-tertiary">(optional)</span>
					{/if}
				</span>
			</button>
		{/each}
	</div>

	<!-- Mobile: compact indicator -->
	<div class="md:hidden flex flex-col items-center gap-2">
		<div class="badge badge-accent badge-lg">
			Schritt {currentStep + 1} von {steps.length}
		</div>
		<h3 class="font-semibold">{steps[currentStep]?.label}</h3>
	</div>
</nav>
