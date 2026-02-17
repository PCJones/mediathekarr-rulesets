<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'info' | 'success' | 'warning' | 'error';
		dismissible?: boolean;
		children: Snippet;
	}

	let {
		variant = 'info',
		dismissible = false,
		children
	}: Props = $props();

	let visible = $state(true);

	let variantClass = $derived(
		variant === 'info' ? 'alert-info' :
		variant === 'success' ? 'alert-success' :
		variant === 'warning' ? 'alert-warning' :
		variant === 'error' ? 'alert-error' : ''
	);

	let iconPath = $derived(
		variant === 'success'
			? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
			: variant === 'warning'
			? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
			: variant === 'error'
			? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
			: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	);
</script>

{#if visible}
	<div class="alert {variantClass}" role="alert">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPath} />
		</svg>
		<div class="flex-1">
			{@render children()}
		</div>
		{#if dismissible}
			<button
				class="btn-ghost btn-icon shrink-0 rounded-full p-1 hover:bg-black/10"
				onclick={() => visible = false}
				aria-label="Schließen"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
				</svg>
			</button>
		{/if}
	</div>
{/if}
