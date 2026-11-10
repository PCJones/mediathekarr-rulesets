<script lang="ts">
	interface Props {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
	}

	let {
		text,
		position = 'top'
	}: Props = $props();

	const GAP = 8;
	const MARGIN = 8;

	let isVisible = $state(false);
	let trigger: HTMLSpanElement;
	let tip = $state<HTMLDivElement | null>(null);
	let coords = $state<{ left: number; top: number } | null>(null);

	$effect(() => {
		if (!isVisible || !tip) {
			coords = null;
			return;
		}
		place(tip);
	});

	/** Escapes ancestor stacking contexts so z-50 is global. */
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	/** Fixed positioning, flipped and clamped so the tooltip stays inside the viewport. */
	function place(el: HTMLDivElement) {
		const t = trigger.getBoundingClientRect();
		const b = el.getBoundingClientRect();
		const centerX = t.left + t.width / 2 - b.width / 2;
		const centerY = t.top + t.height / 2 - b.height / 2;
		const above = t.top - b.height - GAP;
		const below = t.bottom + GAP;

		let left: number;
		let top: number;
		if (position === 'top' || position === 'bottom') {
			left = centerX;
			const fitsAbove = above >= MARGIN;
			const fitsBelow = below + b.height <= window.innerHeight - MARGIN;
			top = position === 'top' ? (fitsAbove || !fitsBelow ? above : below) : (fitsBelow || !fitsAbove ? below : above);
		} else {
			top = centerY;
			const leftSide = t.left - b.width - GAP;
			const rightSide = t.right + GAP;
			const fitsLeft = leftSide >= MARGIN;
			const fitsRight = rightSide + b.width <= window.innerWidth - MARGIN;
			left = position === 'left' ? (fitsLeft || !fitsRight ? leftSide : rightSide) : (fitsRight || !fitsLeft ? rightSide : leftSide);
		}

		coords = {
			left: Math.min(Math.max(left, MARGIN), window.innerWidth - b.width - MARGIN),
			top: Math.min(Math.max(top, MARGIN), window.innerHeight - b.height - MARGIN)
		};
	}
</script>

<span
	bind:this={trigger}
	class="relative inline-flex"
	onmouseenter={() => isVisible = true}
	onmouseleave={() => isVisible = false}
	onfocus={() => isVisible = true}
	onblur={() => isVisible = false}
	role="button"
	tabindex="0"
	aria-describedby={isVisible ? 'tooltip' : undefined}
>
	<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-text-tertiary hover:text-text-secondary cursor-help" viewBox="0 0 20 20" fill="currentColor">
		<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
	</svg>

	{#if isVisible}
		<div
			bind:this={tip}
			use:portal
			id="tooltip"
			role="tooltip"
			class="fixed z-50 w-max max-w-xs rounded border border-border bg-surface-raised px-2 py-1 text-xs text-text-secondary pointer-events-none"
			style:left="{coords?.left ?? 0}px"
			style:top="{coords?.top ?? 0}px"
			style:visibility={coords ? 'visible' : 'hidden'}
		>
			{text}
		</div>
	{/if}
</span>
