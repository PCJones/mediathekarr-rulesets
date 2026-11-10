<script lang="ts">
	import Breadcrumb from '$components/ui/Breadcrumb.svelte';
	import type { WizardStep } from '$stores/ruleset';

	interface Props {
		steps: WizardStep[];
		currentStep: number;
		maxReachable?: number;
		onStepClick: (index: number) => void;
	}

	let { steps, currentStep, maxReachable, onStepClick }: Props = $props();
</script>

<Breadcrumb {steps} {currentStep} {maxReachable} {onStepClick} />
