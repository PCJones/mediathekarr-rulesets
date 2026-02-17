<script lang="ts">
	import { rulesetStore } from '$stores/ruleset';
	import { previewStore } from '$stores/preview';
	import { queryByTopic } from '$api/mediathekview';
	import type { MediathekItem } from '$types';

	// Local state for UI
	let inputValue = $state('');
	let inputFocused = $state(false);

	// Subscribe to shared preview store
	let previewItems = $derived($previewStore.items);
	let isLoading = $derived($previewStore.isLoading);
	let error = $derived($previewStore.error);
	let totalFetched = $derived($previewStore.totalFetched);
	let filteredCount = $derived($previewStore.filteredCount);
	let hasMoreResults = $derived($previewStore.hasMoreResults);

	// Debounce timer
	let previewTimeout: ReturnType<typeof setTimeout>;

	// Track previous topic for change detection
	let previousTopic = $state<string | undefined>(undefined);

	// Get current topic string from store
	let topicString = $derived($rulesetStore.topic);

	// Parse topics from store string
	let topics = $derived(
		topicString
			.split('|')
			.map(t => t.trim())
			.filter(t => t.length > 0)
	);

	// Update store with topics array
	function updateStore(newTopics: string[]) {
		const topicStr = newTopics.join('|');
		rulesetStore.setTopic(topicStr);
	}

	// Add a topic from input
	function addTopic() {
		const value = inputValue.trim();
		if (!value) return;

		// Don't add duplicates
		if (topics.includes(value)) {
			inputValue = '';
			return;
		}

		updateStore([...topics, value]);
		inputValue = '';
	}

	// Remove a topic by index
	function removeTopic(index: number) {
		const newTopics = topics.filter((_, i) => i !== index);
		updateStore(newTopics);
	}

	// Handle key events
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTopic();
		} else if (e.key === 'Backspace' && !inputValue && topics.length > 0) {
			// Remove last topic when backspace on empty input
			removeTopic(topics.length - 1);
		}
	}

	// Handle blur - add current input as topic
	function handleBlur() {
		inputFocused = false;
		if (inputValue.trim()) {
			addTopic();
		}
	}

	// Check if item should be filtered (Audiodeskription or Gebärdensprache)
	function shouldFilter(item: MediathekItem): boolean {
		const title = item.title.toLowerCase();
		// Match with or without parentheses, case-insensitive
		return title.includes('audiodeskription') || title.includes('gebärdensprache') || title.includes('gebardensprache');
	}

	// Fetch preview with debounce
	function fetchPreview(topicStr: string) {
		if (previewTimeout) {
			clearTimeout(previewTimeout);
		}

		if (!topicStr) {
			previewStore.clear();
			return;
		}

		previewTimeout = setTimeout(async () => {
			previewStore.setLoading(true);
			try {
				// Fetch up to 1000 results per topic
				const results = await queryByTopic(topicStr, { maxPerTopic: 1000 });
				const totalFetchedCount = results.length;

				// Check if we hit the 1000 limit (might be more results)
				const topicCount = topicStr.split('|').filter(t => t.trim()).length;
				const moreResults = results.length >= topicCount * 1000;

				// Filter out Audiodeskription and Gebärdensprache
				const filtered = results.filter(item => !shouldFilter(item));
				const filteredOutCount = totalFetchedCount - filtered.length;

				previewStore.setResults({
					items: filtered,
					totalFetched: totalFetchedCount,
					filteredCount: filteredOutCount,
					hasMoreResults: moreResults
				});
			} catch (e) {
				previewStore.setError(e instanceof Error ? e.message : 'Fehler beim Laden der Vorschau');
			}
		}, 500);
	}

	// Reactive preview fetch - triggers on topic changes
	$effect(() => {
		if (topicString && topicString !== previousTopic) {
			previousTopic = topicString;
			fetchPreview(topicString);
		} else if (!topicString && previousTopic) {
			previousTopic = undefined;
			previewStore.clear();
		}
	});

	// Formatting helpers for table display
	function formatDate(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleTimeString('de-DE', {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDuration(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`;
		return `${m} min`;
	}

	// Focus input when clicking container
	let inputRef: HTMLInputElement;
	function focusInput() {
		inputRef?.focus();
	}
</script>

<div class="topic-editor">
	<h2 class="text-2xl font-bold mb-2">Topics definieren</h2>
	<p class="text-base-content/70 mb-6">
		Gib die Mediathek-Topics ein, die zu dieser Show gehören. Drücke <kbd class="kbd kbd-sm">Enter</kbd> um einen Topic hinzuzufügen.
	</p>

	<!-- Tag input -->
	<div class="form-control">
		<label class="label" for="topic-input">
			<span class="label-text">Topics</span>
			<span class="label-text-alt">{topics.length} Topic{topics.length !== 1 ? 's' : ''}</span>
		</label>

		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="tag-input-container"
			class:focused={inputFocused}
			onclick={focusInput}
		>
			{#each topics as topic, index}
				<span class="tag">
					{topic}
					<button
						type="button"
						class="tag-remove"
						onclick={(e) => { e.stopPropagation(); removeTopic(index); }}
						aria-label="Remove {topic}"
					>
						×
					</button>
				</span>
			{/each}
			<input
				bind:this={inputRef}
				id="topic-input"
				type="text"
				placeholder={topics.length === 0 ? "Topic eingeben..." : ""}
				class="tag-input"
				bind:value={inputValue}
				onkeydown={handleKeyDown}
				onfocus={() => inputFocused = true}
				onblur={handleBlur}
			/>
		</div>

		<label class="label">
			<span class="label-text-alt text-base-content/50">
				Tipp: Verwende den exakten Topic-Namen aus MediathekViewWeb
			</span>
		</label>
	</div>

	<!-- Status messages -->
	{#if error}
		<div class="alert alert-warning mt-4">
			<span>{error}</span>
		</div>
	{:else if topics.length > 0 && !isLoading && previewItems.length === 0}
		<div class="alert mt-4">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info h-6 w-6 shrink-0">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<span>Keine Ergebnisse für diese Topics. Überprüfe die Schreibweise.</span>
		</div>
	{/if}

	<!-- Help section -->
	<div class="collapse collapse-arrow bg-base-100 mt-6">
		<input type="checkbox" />
		<div class="collapse-title font-medium">
			Wie finde ich den richtigen Topic-Namen?
		</div>
		<div class="collapse-content text-sm">
			<p class="mb-3">
				<strong>Topic = "Thema"</strong> in MediathekViewWeb
			</p>
			<ol class="list-decimal list-inside space-y-2">
				<li>
					Öffne <a href="https://mediathekviewweb.de" target="_blank" rel="noopener" class="link link-primary">MediathekViewWeb</a>
				</li>
				<li>Suche nach deiner Show</li>
				<li>Der Topic steht in der Spalte "Thema" (nach dem Sender)</li>
				<li>Kopiere den exakten Namen - Groß-/Kleinschreibung ist wichtig!</li>
			</ol>
			<div class="mt-3 p-3 bg-base-200 rounded">
				<p class="font-medium">Beispiele:</p>
				<ul class="list-disc list-inside mt-1">
					<li><code class="text-xs">Tatort</code></li>
					<li><code class="text-xs">Der Bergdoktor</code></li>
					<li><code class="text-xs">Spielfilm</code></li>
				</ul>
			</div>
		</div>
	</div>
</div>

<style>
	.tag-input-container {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		min-height: 3rem;
		background: var(--fallback-b1, oklch(var(--b1)));
		border: 1px solid var(--fallback-bc, oklch(var(--bc) / 0.2));
		border-radius: var(--rounded-btn, 0.5rem);
		cursor: text;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.tag-input-container:hover {
		border-color: var(--fallback-bc, oklch(var(--bc) / 0.4));
	}

	.tag-input-container.focused {
		border-color: var(--fallback-p, oklch(var(--p)));
		box-shadow: 0 0 0 2px var(--fallback-p, oklch(var(--p) / 0.2));
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: var(--fallback-p, oklch(var(--p)));
		color: var(--fallback-pc, oklch(var(--pc)));
		border-radius: var(--rounded-badge, 1rem);
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.tag-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		margin-left: 0.125rem;
		margin-right: -0.25rem;
		border-radius: 50%;
		background: transparent;
		color: inherit;
		opacity: 0.7;
		cursor: pointer;
		transition: opacity 0.15s, background 0.15s;
		border: none;
		font-size: 1rem;
		line-height: 1;
	}

	.tag-remove:hover {
		opacity: 1;
		background: var(--fallback-pc, oklch(var(--pc) / 0.2));
	}

	.tag-input {
		flex: 1;
		min-width: 120px;
		border: none;
		outline: none;
		background: transparent;
		font-size: 0.875rem;
		padding: 0.25rem 0;
	}

	.tag-input::placeholder {
		color: var(--fallback-bc, oklch(var(--bc) / 0.4));
	}
</style>
