<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title?: string;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		children
	}: Props = $props();

	let dialogElement: HTMLDialogElement;

	$effect(() => {
		if (!dialogElement) return;
		if (open) {
			dialogElement.showModal();
		} else {
			dialogElement.close();
		}
	});

	function handleClose() {
		open = false;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogElement) {
			open = false;
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogElement}
	class="fixed inset-0 z-50 m-auto rounded-lg border border-border bg-surface p-0 backdrop:bg-black/50"
	onclose={handleClose}
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && handleClose()}
>
	<div class="min-w-[320px] max-w-lg">
		{#if title}
			<div class="flex items-center justify-between border-b border-border px-4 py-3">
				<h3 class="text-lg font-semibold">{title}</h3>
				<button
					class="rounded-full p-1 text-text-tertiary hover:bg-surface-raised hover:text-text"
					onclick={handleClose}
					aria-label="Schließen"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>
		{/if}
		<div class="p-4">
			{@render children()}
		</div>
	</div>
</dialog>
