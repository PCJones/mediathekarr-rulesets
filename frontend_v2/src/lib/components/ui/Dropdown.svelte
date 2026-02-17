<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	interface Props {
		trigger: Snippet;
		children: Snippet;
		align?: 'left' | 'right';
	}

	let {
		trigger,
		children,
		align = 'right'
	}: Props = $props();

	let isOpen = $state(false);
	let containerElement: HTMLDivElement;

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		isOpen = !isOpen;
	}

	function close() {
		isOpen = false;
	}

	onMount(() => {
		function handleClickOutside(event: MouseEvent) {
			if (containerElement && !containerElement.contains(event.target as Node)) {
				close();
			}
		}
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="relative" bind:this={containerElement}>
	<button type="button" class="contents" onclick={toggle} aria-haspopup="true" aria-expanded={isOpen}>
		{@render trigger()}
	</button>

	{#if isOpen}
		<div
			class="absolute top-full mt-1 z-50 min-w-[160px] rounded-md border border-border bg-surface py-1"
			class:right-0={align === 'right'}
			class:left-0={align === 'left'}
			role="menu"
			tabindex="-1"
			onkeydown={(e) => { if (e.key === 'Escape') close(); }}
		>
			{@render children()}
		</div>
	{/if}
</div>
