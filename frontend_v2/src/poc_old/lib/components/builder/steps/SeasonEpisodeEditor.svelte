<script lang="ts">
	import { rulesetStore } from '$stores/ruleset';
	import { MATCHING_STRATEGIES } from '$types';
	import { validateRegex, isStaticSeasonEpisode, testRegex } from '$utils/regex';

	// Get current state from store
	let seasonRegex = $derived($rulesetStore.seasonRegex || '');
	let episodeRegex = $derived($rulesetStore.episodeRegex || '');
	let currentStrategy = $derived($rulesetStore.matchingStrategy);
	let strategyInfo = $derived(MATCHING_STRATEGIES.find(s => s.value === currentStrategy));

	// Predefined patterns
	const seasonPatterns = [
		{ name: 'S01 (statisch)', pattern: 'S01', description: 'Immer Staffel 1' },
		{ name: '(S##/E##)', pattern: '(?<=S)(\\d{2,4})(?=\\s*/E\\d{2,4})', description: 'Aus Format (S19/E03)' },
		{ name: 'Staffel X', pattern: '(?<=Staffel\\s)(\\d{1,4})', description: 'Aus "Staffel 2"' },
		{ name: 'S##E##', pattern: '(?<=S)(\\d{2})(?=E)', description: 'Aus Format S01E05' }
	];

	const episodePatterns = [
		{ name: '(S##/E##)', pattern: '(?<=\\bS\\d{2,4}\\s*/E)(\\d{2,4})(?=\\))', description: 'Aus Format (S19/E03)' },
		{ name: 'Folge X', pattern: '(?<=Folge\\s)(\\d{1,4})', description: 'Aus "Folge 5"' },
		{ name: 'Episode (XXX)', pattern: '\\((\\d+)\\)', description: 'Nummer in Klammern' },
		{ name: 'S##E##', pattern: '(?<=E)(\\d{2})', description: 'Aus Format S01E05' }
	];

	// Local state for editing (synced to store in real-time)
	let localSeasonRegex = $state(seasonRegex);
	let localEpisodeRegex = $state(episodeRegex);
	let testInput = $state('Wünsche (S19/E03)');

	// Sync from store to local when store changes externally
	$effect(() => {
		localSeasonRegex = seasonRegex;
	});
	$effect(() => {
		localEpisodeRegex = episodeRegex;
	});

	// Real-time sync from local to store
	$effect(() => {
		// Update store immediately as user types (with validation)
		const validation = localSeasonRegex
			? (isStaticSeasonEpisode(localSeasonRegex) ? { valid: true } : validateRegex(localSeasonRegex))
			: { valid: true };
		if (validation.valid && localSeasonRegex !== seasonRegex) {
			rulesetStore.setSeasonRegex(localSeasonRegex);
		}
	});
	$effect(() => {
		const validation = localEpisodeRegex
			? (isStaticSeasonEpisode(localEpisodeRegex) ? { valid: true } : validateRegex(localEpisodeRegex))
			: { valid: true };
		if (validation.valid && localEpisodeRegex !== episodeRegex) {
			rulesetStore.setEpisodeRegex(localEpisodeRegex);
		}
	});

	// Validation
	let seasonValidation = $derived(
		localSeasonRegex
			? (isStaticSeasonEpisode(localSeasonRegex) ? { valid: true } : validateRegex(localSeasonRegex))
			: { valid: true }
	);
	let episodeValidation = $derived(
		localEpisodeRegex
			? (isStaticSeasonEpisode(localEpisodeRegex) ? { valid: true } : validateRegex(localEpisodeRegex))
			: { valid: true }
	);

	// Test results
	let seasonTest = $derived(() => {
		if (!localSeasonRegex || !testInput) return null;
		if (isStaticSeasonEpisode(localSeasonRegex)) {
			return { isStatic: true, value: localSeasonRegex.replace(/^S/i, '') };
		}
		const result = testRegex(localSeasonRegex, testInput);
		return { isStatic: false, ...result };
	});

	let episodeTest = $derived(() => {
		if (!localEpisodeRegex || !testInput) return null;
		if (isStaticSeasonEpisode(localEpisodeRegex)) {
			return { isStatic: true, value: localEpisodeRegex.replace(/^E/i, '') };
		}
		const result = testRegex(localEpisodeRegex, testInput);
		return { isStatic: false, ...result };
	});

	// Use predefined pattern (store is updated automatically via $effect)
	function useSeasonPattern(pattern: string) {
		localSeasonRegex = pattern;
	}

	function useEpisodePattern(pattern: string) {
		localEpisodeRegex = pattern;
	}
</script>

<div class="season-episode-editor">
	<h2 class="text-2xl font-bold mb-2">Season/Episode Extraktion</h2>
	<p class="text-base-content/70 mb-6">
		Definiere, wie Staffel- und Episodennummern aus dem Titel extrahiert werden.
		Du kannst statische Werte (z.B. "S01") oder Regex-Muster verwenden.
	</p>

	{#if !strategyInfo?.requiresSeasonRegex && !strategyInfo?.requiresEpisodeRegex}
		<div class="alert alert-info mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<span>
				Die gewählte Strategie "{strategyInfo?.label}" benötigt keine Season/Episode-Extraktion.
				Dieser Schritt ist optional.
			</span>
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Season Regex -->
		<div class="card bg-base-100">
			<div class="card-body">
				<h3 class="card-title">
					Season-Regex
					{#if strategyInfo?.requiresSeasonRegex}
						<span class="badge badge-warning badge-sm">Erforderlich</span>
					{:else}
						<span class="badge badge-ghost badge-sm">Optional</span>
					{/if}
				</h3>

				<div class="form-control">
					<input
						type="text"
						class="input input-bordered w-full font-mono"
						class:input-error={localSeasonRegex && !seasonValidation.valid}
						placeholder="z.B. S01 oder (?<=S)(\d{2})"
						bind:value={localSeasonRegex}
					/>
					{#if seasonValidation.error}
						<label class="label">
							<span class="label-text-alt text-error">{seasonValidation.error}</span>
						</label>
					{/if}
				</div>

				<!-- Predefined -->
				<div class="mt-2">
					<span class="text-sm text-base-content/70">Vordefiniert:</span>
					<div class="flex flex-wrap gap-2 mt-1">
						{#each seasonPatterns as p}
							<button
								class="btn btn-xs btn-outline"
								onclick={() => useSeasonPattern(p.pattern)}
								title={p.description}
							>
								{p.name}
							</button>
						{/each}
					</div>
				</div>

				<!-- Test result -->
				{#if seasonTest()}
					{@const result = seasonTest()}
					<div class="mt-3 p-2 rounded bg-base-200 text-sm">
						{#if result.isStatic}
							<span class="text-success">Statisch: {result.value}</span>
						{:else if result.matches}
							<span class="text-success">Extrahiert: {result.firstGroup}</span>
						{:else}
							<span class="text-error">Kein Treffer</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Episode Regex -->
		<div class="card bg-base-100">
			<div class="card-body">
				<h3 class="card-title">
					Episode-Regex
					{#if strategyInfo?.requiresEpisodeRegex}
						<span class="badge badge-warning badge-sm">Erforderlich</span>
					{:else}
						<span class="badge badge-ghost badge-sm">Optional</span>
					{/if}
				</h3>

				<div class="form-control">
					<input
						type="text"
						class="input input-bordered w-full font-mono"
						class:input-error={localEpisodeRegex && !episodeValidation.valid}
						placeholder="z.B. E05 oder (?<=E)(\d{2})"
						bind:value={localEpisodeRegex}
					/>
					{#if episodeValidation.error}
						<label class="label">
							<span class="label-text-alt text-error">{episodeValidation.error}</span>
						</label>
					{/if}
				</div>

				<!-- Predefined -->
				<div class="mt-2">
					<span class="text-sm text-base-content/70">Vordefiniert:</span>
					<div class="flex flex-wrap gap-2 mt-1">
						{#each episodePatterns as p}
							<button
								class="btn btn-xs btn-outline"
								onclick={() => useEpisodePattern(p.pattern)}
								title={p.description}
							>
								{p.name}
							</button>
						{/each}
					</div>
				</div>

				<!-- Test result -->
				{#if episodeTest()}
					{@const result = episodeTest()}
					<div class="mt-3 p-2 rounded bg-base-200 text-sm">
						{#if result.isStatic}
							<span class="text-success">Statisch: {result.value}</span>
						{:else if result.matches}
							<span class="text-success">Extrahiert: {result.firstGroup}</span>
						{:else}
							<span class="text-error">Kein Treffer</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Test input -->
	<div class="form-control mt-6">
		<label class="label" for="test-input">
			<span class="label-text">Test-Eingabe</span>
		</label>
		<input
			id="test-input"
			type="text"
			class="input input-bordered w-full"
			placeholder="Beispiel-Titel zum Testen"
			bind:value={testInput}
		/>
		<label class="label">
			<span class="label-text-alt">Gib einen Beispiel-Titel ein, um die Extraktion zu testen</span>
		</label>
	</div>

	<!-- Info box -->
	<div class="collapse collapse-arrow bg-base-100 mt-6">
		<input type="checkbox" />
		<div class="collapse-title font-medium">
			Statische vs. Regex-Werte
		</div>
		<div class="collapse-content text-sm">
			<p class="mb-3">
				Du kannst <strong>statische Werte</strong> oder <strong>Regex-Muster</strong> verwenden:
			</p>
			<ul class="list-disc list-inside space-y-2">
				<li>
					<code class="bg-base-200 px-1 rounded">S01</code> = Statisch, jedes Ergebnis dieses Ruleset wird als Staffel 1 erkannt
				</li>
				<li>
					<code class="bg-base-200 px-1 rounded">E05</code> = Statisch, jedes Ergebnis dieses Ruleset wird als Folge 5 erkannt
				</li>
				<li>
					<code class="bg-base-200 px-1 rounded">(?&lt;=S)(\d{'{2}'})</code> = Regex, extrahiert Zahl nach "S"
				</li>
			</ul>
			<p class="mt-3 text-base-content/70">
				Statische Werte werden automatisch erkannt, wenn sie dem Format S## oder E## entsprechen.
			</p>
		</div>
	</div>

	</div>
