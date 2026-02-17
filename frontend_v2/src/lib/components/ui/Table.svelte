<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="overflow-x-auto rounded-lg border border-border">
	<table class="data-table">
		{@render children()}
	</table>
</div>
