<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
	}

	let { size = 'md' }: Props = $props();

	let sizeClass = $derived(
		size === 'sm' ? 'spinner-sm' :
		size === 'lg' ? 'spinner-lg' : 'spinner-md'
	);
</script>

<span class="spinner {sizeClass}" role="status" aria-label="Laden..."></span>
