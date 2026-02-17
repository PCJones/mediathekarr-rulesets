<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'info';
		size?: 'sm' | 'md' | 'lg';
		children: Snippet;
	}

	let {
		variant = 'default',
		size = 'md',
		children
	}: Props = $props();

	let variantClass = $derived(
		variant === 'accent' ? 'badge-accent' :
		variant === 'success' ? 'badge-success' :
		variant === 'warning' ? 'badge-warning' :
		variant === 'error' ? 'badge-error' :
		variant === 'info' ? 'badge-info' : ''
	);

	let sizeClass = $derived(
		size === 'sm' ? 'badge-sm' :
		size === 'lg' ? 'badge-lg' : ''
	);
</script>

<span class="badge {variantClass} {sizeClass}">
	{@render children()}
</span>
