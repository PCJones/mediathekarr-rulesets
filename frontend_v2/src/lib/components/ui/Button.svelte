<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		loading?: boolean;
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'secondary',
		size = 'md',
		disabled = false,
		loading = false,
		href,
		type = 'button',
		onclick,
		children
	}: Props = $props();

	let variantClass = $derived(
		variant === 'primary' ? 'btn-primary' :
		variant === 'ghost' ? 'btn-ghost' :
		variant === 'danger' ? 'btn-danger' : ''
	);

	let sizeClass = $derived(
		size === 'sm' ? 'btn-sm' :
		size === 'lg' ? 'btn-lg' : ''
	);
</script>

{#if href && !disabled}
	<a {href} class="btn {variantClass} {sizeClass}" class:opacity-50={loading}>
		{#if loading}
			<span class="spinner spinner-sm"></span>
		{/if}
		{@render children()}
	</a>
{:else}
	<button
		{type}
		class="btn {variantClass} {sizeClass}"
		disabled={disabled || loading}
		{onclick}
	>
		{#if loading}
			<span class="spinner spinner-sm"></span>
		{/if}
		{@render children()}
	</button>
{/if}
