<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		padding?: 'none' | 'sm' | 'md' | 'lg';
		children: Snippet;
	}

	let {
		padding = 'md',
		children
	}: Props = $props();

	let paddingClass = $derived(
		padding === 'none' ? 'card-body-none' :
		padding === 'sm' ? 'card-body-sm' :
		padding === 'lg' ? 'card-body-lg' : 'card-body'
	);
</script>

<div class="card">
	<div class={paddingClass}>
		{@render children()}
	</div>
</div>
