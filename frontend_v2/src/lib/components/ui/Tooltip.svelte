<script lang="ts">
	interface Props {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
	}

	let {
		text,
		position = 'top'
	}: Props = $props();

	let isVisible = $state(false);

	let positionClasses = $derived(
		position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' :
		position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2' :
		position === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2' :
		'left-full top-1/2 -translate-y-1/2 ml-2'
	);
</script>

<span
	class="relative inline-flex"
	onmouseenter={() => isVisible = true}
	onmouseleave={() => isVisible = false}
	onfocus={() => isVisible = true}
	onblur={() => isVisible = false}
	role="button"
	tabindex="0"
	aria-describedby={isVisible ? 'tooltip' : undefined}
>
	<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-text-tertiary hover:text-text-secondary cursor-help" viewBox="0 0 20 20" fill="currentColor">
		<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
	</svg>

	{#if isVisible}
		<div
			id="tooltip"
			role="tooltip"
			class="absolute {positionClasses} z-50 whitespace-nowrap rounded border border-border bg-surface-raised px-2 py-1 text-xs text-text-secondary pointer-events-none"
		>
			{text}
		</div>
	{/if}
</span>
