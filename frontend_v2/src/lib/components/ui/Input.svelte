<script lang="ts">
	interface Props {
		type?: string;
		value?: string | number;
		label?: string;
		error?: string;
		disabled?: boolean;
		monospace?: boolean;
		placeholder?: string;
		id?: string;
		size?: 'sm' | 'md';
		oninput?: (e: Event) => void;
		onkeydown?: (e: KeyboardEvent) => void;
	}

	let {
		type = 'text',
		value = $bindable(''),
		label,
		error,
		disabled = false,
		monospace = false,
		placeholder,
		id,
		size = 'md',
		oninput,
		onkeydown
	}: Props = $props();

	let inputId = $derived(id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined));
</script>

<div class="flex flex-col gap-1">
	{#if label}
		<label for={inputId} class="text-sm font-medium text-text-secondary">
			{label}
		</label>
	{/if}
	<input
		id={inputId}
		{type}
		class="input {size === 'sm' ? 'input-sm' : ''}"
		class:font-mono={monospace}
		{placeholder}
		{disabled}
		bind:value
		{oninput}
		{onkeydown}
	/>
	{#if error}
		<p class="text-xs text-error">{error}</p>
	{/if}
</div>
