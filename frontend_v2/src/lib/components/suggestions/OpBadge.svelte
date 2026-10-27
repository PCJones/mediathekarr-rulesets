<script lang="ts">
	import type { ChangeOp } from '$types/suggestion';
	import Badge from '$components/ui/Badge.svelte';

	interface Props {
		op: ChangeOp;
		stale?: boolean;
		size?: 'sm' | 'md' | 'lg';
	}

	let { op, stale = false, size = 'sm' }: Props = $props();

	let variant = $derived(
		stale ? ('warning' as const) :
		op === 'create' ? ('success' as const) :
		op === 'delete' ? ('error' as const) : ('info' as const)
	);

	let label = $derived(
		stale ? 'Veraltet' :
		op === 'create' ? 'Neu' :
		op === 'delete' ? 'Wird gelöscht' : 'Geändert'
	);
</script>

<Badge {variant} {size}>{label}</Badge>
