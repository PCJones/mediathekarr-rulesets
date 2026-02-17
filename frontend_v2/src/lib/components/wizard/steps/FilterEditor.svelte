<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { rulesetStore, wizardStore } from '$stores/ruleset';
	import { draftStore } from '$stores/draft';
	import type { Filter, FilterAttribute, FilterType, DurationInfo } from '$types';

	// Get context from WizardBuilder
	const ctx = getContext<{ durationInfo: DurationInfo | null }>('wizardCallbacks');

	// Track auto-added duration filter value (to show badge when matching)
	let autoAddedDurationValue = $state<string | null>(null);
	// Store durationInfo for display in template
	let storedDurationInfo = $state<DurationInfo | null>(null);

	// Filter type options
	const filterAttributes: { value: FilterAttribute; label: string }[] = [
		{ value: 'duration', label: 'Dauer (Minuten)' },
		{ value: 'channel', label: 'Sender' },
		{ value: 'topic', label: 'Topic' },
		{ value: 'title', label: 'Titel' },
		{ value: 'description', label: 'Beschreibung' }
	];

	const filterTypes: { value: FilterType; label: string; forNumeric: boolean; forString: boolean }[] = [
		{ value: 'GreaterThan', label: 'Größer als', forNumeric: true, forString: false },
		{ value: 'LessThan', label: 'Kleiner als', forNumeric: true, forString: false },
		{ value: 'Equals', label: 'Ist gleich', forNumeric: true, forString: true },
		{ value: 'Contains', label: 'Enthält', forNumeric: false, forString: true },
		{ value: 'Regex', label: 'Regex', forNumeric: false, forString: true }
	];

	// Get current filters from store
	let filters = $derived($rulesetStore.filters);

	// New filter form state
	let newFilter = $state<Filter>({
		attribute: 'title',
		type: 'Contains',
		value: ''
	});

	// Determine if current attribute is numeric
	let isNumericAttribute = $derived(newFilter.attribute === 'duration');

	// Filter available types based on attribute
	let availableTypes = $derived(
		filterTypes.filter(t => isNumericAttribute ? t.forNumeric : t.forString)
	);

	// Regex validation error
	let regexError = $state<string | null>(null);

	// Validate regex pattern
	function validateRegexPattern(pattern: string): string | null {
		if (!pattern.trim()) return null;
		try {
			new RegExp(pattern);
			return null;
		} catch (e) {
			return e instanceof Error ? e.message : 'Ungültiges Regex-Muster';
		}
	}

	// Check regex validity when value changes (for Regex type)
	$effect(() => {
		if (newFilter.type === 'Regex') {
			regexError = validateRegexPattern(newFilter.value);
		} else {
			regexError = null;
		}
	});

	// Sync draft filter for real-time preview
	$effect(() => {
		// Only set draft if value is non-empty and valid (handle both string and number values)
		if (String(newFilter.value).trim() && !regexError) {
			draftStore.setDraftFilter({ ...newFilter });
		} else {
			draftStore.clearFilter();
		}
	});

	// Reset type if not compatible with new attribute
	$effect(() => {
		const currentTypeValid = availableTypes.some(t => t.value === newFilter.type);
		if (!currentTypeValid && availableTypes.length > 0) {
			newFilter.type = availableTypes[0].value;
		}
	});

	// Auto-add duration filter when creating new ruleset with TVDB data
	onMount(() => {
		const durationInfo = ctx?.durationInfo;
		// Only auto-add when creating new (not editing) and durationInfo exists
		if (!$wizardStore.isEditing && durationInfo?.suggestedMinDuration) {
			const hasDurationFilter = filters.some(f => f.attribute === 'duration');
			if (!hasDurationFilter) {
				const suggestedValue = String(durationInfo.suggestedMinDuration);
				rulesetStore.addFilter({
					attribute: 'duration',
					type: 'GreaterThan',
					value: suggestedValue
				});
				autoAddedDurationValue = suggestedValue;
				storedDurationInfo = durationInfo;
			}
		}
	});

	// Check if a filter is the auto-added one
	function isAutoAdded(filter: Filter): boolean {
		return (
			autoAddedDurationValue !== null &&
			filter.attribute === 'duration' &&
			filter.type === 'GreaterThan' &&
			filter.value === autoAddedDurationValue
		);
	}

	// Add new filter
	function addFilter() {
		if (!String(newFilter.value).trim()) return;

		// Don't allow adding invalid regex
		if (newFilter.type === 'Regex' && regexError) return;

		rulesetStore.addFilter({ ...newFilter });

		// Clear draft and reset form
		draftStore.clearFilter();
		newFilter = {
			attribute: 'title',
			type: 'Contains',
			value: ''
		};
		regexError = null;
	}

	// Remove filter
	function removeFilter(index: number) {
		rulesetStore.removeFilter(index);
	}

	// Get display text for filter
	function getFilterDisplay(filter: Filter): string {
		const type = filterTypes.find(t => t.value === filter.type)?.label || filter.type;
		const value = filter.attribute === 'duration' ? `${filter.value} min` : `"${filter.value}"`;
		return `${type} ${value}`;
	}

	// Get placeholder text for filter value input
	function getPlaceholder(attribute: FilterAttribute): string {
		const placeholders: Record<FilterAttribute, string> = {
			duration: 'z.B. 30',
			channel: 'z.B. ZDF',
			topic: '',
			title: '',
			description: 'z.B. ermittelt'
		};
		return placeholders[attribute] || '';
	}
</script>

<div class="filter-editor">
	<h2 class="text-xl font-bold mb-1">Filter hinzufügen</h2>
	<p class="text-text-secondary text-sm mb-4">
		Filter grenzen die Ergebnisse ein, bevor der Titel-Abgleich erfolgt.
	</p>

	<!-- Current filters -->
	{#if filters.length > 0}
		<div class="mb-6">
			<h3 class="font-medium mb-3">Aktive Filter ({filters.length})</h3>
			<div class="space-y-2">
				{#each filters as filter, index}
					<div class="flex items-center gap-2 bg-bg p-3 rounded-lg">
						<span class="badge badge-accent">
							{filterAttributes.find(a => a.value === filter.attribute)?.label}
						</span>
						<span class="flex-1">{getFilterDisplay(filter)}</span>
						{#if isAutoAdded(filter) && storedDurationInfo}
							<span class="badge badge-info badge-sm" title="Automatisch berechnet: {Math.round(storedDurationInfo.percentageUsed * 100)}% von O {storedDurationInfo.averageRuntime} min">
								{Math.round(storedDurationInfo.percentageUsed * 100)}% von O {storedDurationInfo.averageRuntime} min
							</span>
						{/if}
						<button
							class="btn btn-ghost btn-sm btn-icon rounded-full"
							onclick={() => removeFilter(index)}
							aria-label="Filter entfernen"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Add new filter form -->
	<div class="card">
		<div class="card-body">
			<h3 class="font-semibold text-lg">Neuen Filter hinzufügen</h3>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<!-- Attribute -->
				<div class="flex flex-col gap-1">
					<label class="text-sm font-medium text-text-secondary" for="filter-attribute">
						Attribut
					</label>
					<select
						id="filter-attribute"
						class="select w-full"
						bind:value={newFilter.attribute}
					>
						{#each filterAttributes as attr}
							<option value={attr.value}>{attr.label}</option>
						{/each}
					</select>
				</div>

				<!-- Type -->
				<div class="flex flex-col gap-1">
					<label class="text-sm font-medium text-text-secondary" for="filter-type">
						Bedingung
					</label>
					<select
						id="filter-type"
						class="select w-full"
						bind:value={newFilter.type}
					>
						{#each availableTypes as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>

			</div>

		<!-- Value row (full width) -->
		<div class="flex flex-col gap-1">
			<label class="text-sm font-medium text-text-secondary" for="filter-value">
				Wert {#if newFilter.attribute === 'duration'}(Minuten){:else if newFilter.type === 'Regex'}(Regex-Muster){/if}
			</label>
			<input
				id="filter-value"
				type={isNumericAttribute ? 'number' : 'text'}
				class="input w-full"
				class:border-error={regexError}
				placeholder={newFilter.type === 'Regex' ? 'z.B. S(17|18)' : getPlaceholder(newFilter.attribute)}
				bind:value={newFilter.value}
				min={isNumericAttribute ? '0' : undefined}
			/>
			{#if regexError}
				<span class="text-xs text-error">{regexError}</span>
			{:else if newFilter.type === 'Regex'}
				<span class="text-xs text-text-tertiary">Prüft ob das Muster im Text vorkommt</span>
			{/if}
		</div>

			<div class="flex justify-end mt-4">
				<button
					class="btn btn-primary"
					onclick={addFilter}
					disabled={!String(newFilter.value).trim() || !!regexError}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
					</svg>
					Filter hinzufügen
				</button>
			</div>
		</div>
	</div>

	<!-- Quick add suggestions -->
	<div class="mt-6">
		<h3 class="font-medium mb-3">Schnell hinzufügen</h3>
		<div class="flex flex-wrap gap-2">
			<button
				class="btn btn-sm"
				onclick={() => {
					newFilter = { attribute: 'duration', type: 'GreaterThan', value: '30' };
					addFilter();
				}}
			>
				Dauer &gt; 30 min
			</button>
			<button
				class="btn btn-sm"
				onclick={() => {
					newFilter = { attribute: 'duration', type: 'GreaterThan', value: '45' };
					addFilter();
				}}
			>
				Dauer &gt; 45 min
			</button>
		</div>
	</div>

	<!-- Info box -->
	<div class="alert mt-6">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>
		<div>
			<p class="font-medium">Tipp: Mindestdauer-Filter</p>
			<p class="text-sm">
				Ein Dauer-Filter hilft, Trailer, Vorschauen und Kurzclips auszufiltern.
				{#if autoAddedDurationValue !== null && storedDurationInfo}
					Ein Mindestdauer-Filter wurde automatisch hinzugefügt:
					{Math.round(storedDurationInfo.percentageUsed * 100)}% der durchschnittlichen Episodenlänge
					(O {storedDurationInfo.averageRuntime} min aus {storedDurationInfo.analyzedEpisodes} Episoden).
					Du kannst diesen anpassen oder entfernen.
				{/if}
			</p>
		</div>
	</div>

	<!-- Second tip: not too restrictive -->
	<div class="alert mt-4">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-warning shrink-0 w-6 h-6">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>
		<div>
			<p class="font-medium">Wichtig: Nicht zu restriktiv filtern</p>
			<p class="text-sm">
				Filtere nur, was wirklich nötig ist. Vermeide z.B. Sender-Filter,
				es sei denn, das Ruleset gilt nur für einen bestimmten Sender oder
				andere Sender verursachen falsche Ergebnisse.
			</p>
		</div>
	</div>

	</div>
