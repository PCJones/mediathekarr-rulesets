<script lang="ts">
	import type { BundleCoverage } from '$types/suggestion';
	import Delta from './Delta.svelte';

	interface Props {
		coverage: BundleCoverage | null;
		size?: 'sm' | 'md' | 'lg';
	}

	let { coverage, size = 'md' }: Props = $props();

	const explanation = 'Videos, denen ein Ruleset eine TVDB-Episode zuordnet';
</script>

{#if !coverage}
	<span class="text-xs text-text-tertiary">Keine Messdaten</span>
{:else}
	<span title={explanation}>
		<Delta
			label="Zugeordnet"
			before={coverage.before.coveredByAny}
			after={coverage.after.coveredByAny}
			{size}
		/>
	</span>
{/if}
