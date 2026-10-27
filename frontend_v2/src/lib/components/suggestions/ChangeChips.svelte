<script lang="ts">
	import type { ChangeCounts } from '$types/suggestion';

	interface Props {
		counts: ChangeCounts;
	}

	let { counts }: Props = $props();
</script>

<span class="inline-flex items-center gap-1">
	{#if counts.create > 0}
		<span class="badge badge-sm badge-success font-mono tabular-nums" title="{counts.create} neue Rulesets">
			+{counts.create}
		</span>
	{/if}
	{#if counts.update > 0}
		<span class="badge badge-sm badge-info font-mono tabular-nums" title="{counts.update} geänderte Rulesets">
			~{counts.update}
		</span>
	{/if}
	{#if counts.delete > 0}
		<span class="badge badge-sm badge-error font-mono tabular-nums" title="{counts.delete} gelöschte Rulesets">
			−{counts.delete}
		</span>
	{/if}
</span>
