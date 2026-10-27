<script lang="ts">
	interface Props {
		name: string;
		highlight?: boolean;
	}

	let { name, highlight = false }: Props = $props();
</script>

<span
	class="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase"
	class:avatar-highlight={highlight}
	class:bg-surface-raised={!highlight}
	class:text-text-secondary={!highlight}
	aria-hidden="true"
>
	{name.charAt(0)}
</span>

<style>
	.avatar-highlight {
		background-color: color-mix(in srgb, var(--color-accent) 15%, var(--color-bg));
		color: var(--color-accent);
	}
</style>
