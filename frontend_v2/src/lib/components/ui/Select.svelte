<script lang="ts">
	interface SelectOption {
		value: string;
		label: string;
	}

	interface Props {
		options: SelectOption[];
		value?: string;
		label?: string;
		placeholder?: string;
		id?: string;
		disabled?: boolean;
		onchange?: (e: Event) => void;
	}

	let {
		options,
		value = $bindable(''),
		label,
		placeholder,
		id,
		disabled = false,
		onchange
	}: Props = $props();

	let selectId = $derived(id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined));
</script>

<div class="flex flex-col gap-1">
	{#if label}
		<label for={selectId} class="text-sm font-medium text-text-secondary">
			{label}
		</label>
	{/if}
	<select
		id={selectId}
		class="select"
		{disabled}
		bind:value
		{onchange}
	>
		{#if placeholder}
			<option value="" disabled>{placeholder}</option>
		{/if}
		{#each options as option}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>
