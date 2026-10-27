<script lang="ts">
	interface Props {
		before: number | null;
		after: number | null;
		total?: number | null;
		label?: string;
		size?: 'sm' | 'md' | 'lg';
	}

	let { before, after, total = null, label, size = 'md' }: Props = $props();

	let delta = $derived(before !== null && after !== null ? after - before : null);

	let textSize = $derived(size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm');
	let badgeSize = $derived(size === 'lg' ? '' : 'badge-sm');

	function show(value: number | null): string {
		return value === null ? '–' : String(value);
	}

	function signed(value: number): string {
		return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
	}
</script>

<span class="inline-flex items-center gap-1.5 {textSize}">
	{#if label}
		<span class="text-text-secondary">{label}</span>
	{/if}
	<span class="font-mono tabular-nums">{show(before)}</span>
	<span class="text-text-tertiary">→</span>
	<span class="font-mono tabular-nums font-medium">{show(after)}</span>
	{#if total !== null}
		<span class="font-mono tabular-nums text-text-tertiary">/ {total}</span>
	{/if}
	{#if delta !== null && delta !== 0}
		<span class="badge {badgeSize} {delta > 0 ? 'badge-success' : 'badge-error'} font-mono tabular-nums">
			{signed(delta)}
		</span>
	{/if}
</span>
