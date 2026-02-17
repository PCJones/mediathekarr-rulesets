<script lang="ts">
	import { rulesetStore } from '$stores/ruleset';
	import { draftStore } from '$stores/draft';
	import { previewStore } from '$stores/preview';
	import { MATCHING_STRATEGIES, type RegexRule, type RegexRuleField } from '$types';
	import { validateRegex } from '$utils/regex';

	// Fields for regex extraction
	const regexFields: { value: RegexRuleField; label: string }[] = [
		{ value: 'title', label: 'Titel' },
		{ value: 'topic', label: 'Topic' },
		{ value: 'description', label: 'Beschreibung' },
		{ value: 'channel', label: 'Sender' }
	];

	// Predefined patterns
	const predefinedPatterns = [
		{ name: 'Alles', pattern: '(.*)' },
		{ name: 'Nach Doppelpunkt', pattern: '(?<=: )(.+)$' },
		{ name: 'Vor Klammer', pattern: '^(.+?)\\s*\\(' },
		{ name: 'In Klammern', pattern: '\\(([^)]+)\\)' },
		{ name: 'Folge X: Titel', pattern: '^Folge \\d+: (.+)$' }
	];

	// Get current state from store
	let titleRules = $derived($rulesetStore.titleRegexRules);
	let currentStrategy = $derived($rulesetStore.matchingStrategy);
	let strategyInfo = $derived(MATCHING_STRATEGIES.find(s => s.value === currentStrategy));

	// Get preview items for examples
	let previewItems = $derived($previewStore.items);

	// Build a fully constructed example from the first successful item
	let constructedExample = $derived.by(() => {
		if (titleRules.length === 0 || previewItems.length === 0) return null;

		// Try each preview item until we find one that works with all rules
		for (const item of previewItems) {
			let result = '';
			let success = true;

			for (const rule of titleRules) {
				if (rule.type === 'static') {
					result += rule.value || '';
				} else if (rule.pattern && rule.field) {
					const fieldValue = item[rule.field as keyof typeof item] as string;
					if (!fieldValue) {
						success = false;
						break;
					}
					try {
						const regex = new RegExp(rule.pattern);
						const match = fieldValue.match(regex);
						if (match && match[1]) {
							result += match[1];
						} else if (match && match[0]) {
							result += match[0];
						} else {
							success = false;
							break;
						}
					} catch {
						success = false;
						break;
					}
				}
			}

			if (success && result) {
				return { title: item.title, constructed: result };
			}
		}
		return null;
	});

	// New rule form state
	let newRuleType = $state<'static' | 'regex'>('regex');
	let newStaticValue = $state('');
	let newRegexField = $state<RegexRuleField>('title');
	let newRegexPattern = $state('');

	// Validation for new pattern
	let patternValidation = $derived(validateRegex(newRegexPattern));

	// Sync draft title rule for real-time preview
	$effect(() => {
		if (newRuleType === 'static') {
			// Static rule: show preview if value is non-empty
			if (newStaticValue.trim()) {
				draftStore.setDraftTitleRule({
					type: 'static',
					value: newStaticValue
				});
			} else {
				draftStore.clearTitleRule();
			}
		} else {
			// Regex rule: show preview if pattern is non-empty and valid
			if (newRegexPattern.trim() && patternValidation.valid) {
				draftStore.setDraftTitleRule({
					type: 'regex',
					field: newRegexField,
					pattern: newRegexPattern
				});
			} else {
				draftStore.clearTitleRule();
			}
		}
	});

	// Add new rule
	function addRule() {
		if (newRuleType === 'static') {
			if (!newStaticValue.trim()) return;
			rulesetStore.addTitleRule({
				type: 'static',
				value: newStaticValue
			});
			draftStore.clearTitleRule();
			newStaticValue = '';
		} else {
			if (!newRegexPattern.trim() || !patternValidation.valid) return;
			rulesetStore.addTitleRule({
				type: 'regex',
				field: newRegexField,
				pattern: newRegexPattern
			});
			draftStore.clearTitleRule();
			newRegexPattern = '';
		}
	}

	// Use predefined pattern
	function usePredefinedPattern(pattern: string) {
		newRegexPattern = pattern;
	}

	// Remove rule
	function removeRule(index: number) {
		rulesetStore.removeTitleRule(index);
	}

	// Move rule up/down
	function moveRule(index: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex >= 0 && newIndex < titleRules.length) {
			rulesetStore.moveTitleRule(index, newIndex);
		}
	}
</script>

<div class="title-rules-editor">
	<h2 class="text-xl font-bold mb-1">Titel-Regeln</h2>
	<p class="text-text-secondary text-sm mb-4">
		Definiere Regeln, um den Titel für den TVDB-Abgleich zu konstruieren.
		Regeln werden in Reihenfolge angewendet und bauen aufeinander auf.
	</p>

	<!-- Tip about multiple rulesets -->
	<div class="alert mb-6">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>
		<span class="text-sm">
			<strong>Tipp:</strong> Manchmal ist es nicht möglich, alle Titel-Varianten mit einem einzigen Ruleset abzudecken.
			In solchen Fällen können mehrere Rulesets für dieselbe Serie erstellt werden.
		</span>
	</div>

	{#if !strategyInfo?.requiresTitleRules}
		<div class="alert alert-info mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<span>
				Die gewählte Strategie "{strategyInfo?.label}" benötigt keine Titel-Regeln.
				Dieser Schritt ist optional.
			</span>
		</div>
	{/if}

	<!-- Current rules -->
	{#if titleRules.length > 0}
		<div class="mb-6">
			<h3 class="font-medium mb-3">Aktive Regeln ({titleRules.length})</h3>
			<div class="space-y-2">
				{#each titleRules as rule, index}
					<div class="flex items-center gap-2 bg-bg p-3 rounded-lg">
						<span class="badge" class:badge-accent={rule.type === 'regex'}>
							{index + 1}. {rule.type === 'static' ? 'Statisch' : 'Regex'}
						</span>

						<div class="flex-1 flex items-center gap-2 min-w-0">
							{#if rule.type === 'static'}
								<code class="bg-surface px-2 py-1 rounded text-sm">"{rule.value}"</code>
							{:else}
								<code class="bg-surface px-2 py-1 rounded text-sm">{rule.pattern}</code>
								<span class="text-sm text-text-tertiary">aus {rule.field}</span>
							{/if}
						</div>

						<div class="flex gap-1 shrink-0">
							<button
								class="btn btn-ghost btn-sm btn-icon"
								onclick={() => moveRule(index, 'up')}
								disabled={index === 0}
								aria-label="Nach oben"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
									<path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
								</svg>
							</button>
							<button
								class="btn btn-ghost btn-sm btn-icon"
								onclick={() => moveRule(index, 'down')}
								disabled={index === titleRules.length - 1}
								aria-label="Nach unten"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
									<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
								</svg>
							</button>
							<button
								class="btn btn-ghost btn-sm btn-icon text-error"
								onclick={() => removeRule(index)}
								aria-label="Entfernen"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
									<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>

			<!-- Constructed example -->
			{#if constructedExample}
				<div class="mt-4 p-3 bg-success/10 rounded-lg text-sm">
					<span class="text-text-secondary">Beispiel:</span>
					<span class="ml-2">"{constructedExample.title}"</span>
					<span class="mx-2">-></span>
					<span class="font-medium text-success">"{constructedExample.constructed}"</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Add new rule -->
	<div class="card">
		<div class="card-body">
			<h3 class="font-semibold text-lg">Neue Regel hinzufügen</h3>

			<!-- Rule type tabs -->
			<div class="flex gap-1 bg-surface rounded-lg p-1 w-fit">
				<button
					class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
					class:bg-bg={newRuleType === 'regex'}
					class:text-text={newRuleType === 'regex'}
					class:text-text-secondary={newRuleType !== 'regex'}
					onclick={() => newRuleType = 'regex'}
				>
					Regex-Extraktion
				</button>
				<button
					class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
					class:bg-bg={newRuleType === 'static'}
					class:text-text={newRuleType === 'static'}
					class:text-text-secondary={newRuleType !== 'static'}
					onclick={() => newRuleType = 'static'}
				>
					Statischer Text
				</button>
			</div>

			{#if newRuleType === 'static'}
				<!-- Static rule form -->
				<div class="flex flex-col gap-1 mt-4 max-w-sm">
					<label class="text-sm font-medium text-text-secondary" for="static-value">
						Text, der angehängt wird
					</label>
					<input
						id="static-value"
						type="text"
						class="input w-full"
						placeholder='z.B. " - " oder "Folge "'
						bind:value={newStaticValue}
					/>
					<span class="text-xs text-success">Statische Regeln können nie fehlschlagen</span>
				</div>
			{:else}
				<!-- Regex rule form -->
				<div class="space-y-2 mt-4 max-w-sm">
					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium text-text-secondary" for="regex-field">
							Feld
						</label>
						<select
							id="regex-field"
							class="select w-full"
							bind:value={newRegexField}
						>
							{#each regexFields as field}
								<option value={field.value}>{field.label}</option>
							{/each}
						</select>
					</div>

					<div class="flex flex-col gap-1">
						<div class="flex items-center justify-between">
							<label class="text-sm font-medium text-text-secondary" for="regex-pattern">
								Regex-Muster
							</label>
							{#if patternValidation.error}
								<span class="text-xs text-error">{patternValidation.error}</span>
							{/if}
						</div>
						<input
							id="regex-pattern"
							type="text"
							class="input w-full font-mono"
							class:border-error={newRegexPattern && !patternValidation.valid}
							placeholder="z.B. (?<=: )(.+)$"
							bind:value={newRegexPattern}
						/>
					</div>
				</div>

				<!-- Predefined patterns -->
				<div class="mt-3">
					<span class="text-sm text-text-secondary">Vordefiniert:</span>
					<div class="flex flex-wrap gap-2 mt-1">
						{#each predefinedPatterns as p}
							<button
								class="btn btn-sm"
								onclick={() => usePredefinedPattern(p.pattern)}
							>
								{p.name}
							</button>
						{/each}
					</div>
				</div>

				<div class="alert alert-warning mt-4">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<span class="text-sm">
						Wenn eine Regex-Regel fehlschlägt (kein Treffer), wird die gesamte Titel-Konstruktion abgebrochen
						und der Eintrag wird nicht zugeordnet.
					</span>
				</div>
			{/if}

			<div class="flex justify-end mt-4">
				<button
					class="btn btn-primary"
					onclick={addRule}
					disabled={newRuleType === 'static' ? !newStaticValue.trim() : (!newRegexPattern.trim() || !patternValidation.valid)}
				>
					Regel hinzufügen
				</button>
			</div>
		</div>
	</div>

	<!-- Regex help section -->
	<details class="mt-6 rounded-lg border border-border bg-bg">
		<summary class="cursor-pointer font-medium px-4 py-3">
			Wie funktioniert Regex?
		</summary>
		<div class="px-4 pb-4 text-sm">
			<p class="mb-3">
				<strong>Regex</strong> (Regular Expression) ist ein Suchmuster zum Extrahieren von Text.
			</p>

			<div class="alert alert-info mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<span>
					<strong>Wichtig:</strong> Nur der <u>erste Klammerinhalt</u> <code class="bg-surface px-1 rounded">(...)</code> wird extrahiert!
				</span>
			</div>

			<p class="font-medium mb-2">Häufige Muster:</p>
			<div class="overflow-x-auto rounded-md border border-border">
				<table class="data-table">
					<thead>
						<tr>
							<th>Muster</th>
							<th>Bedeutung</th>
							<th>Beispiel</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td><code class="bg-surface px-1 rounded">(.*)</code></td>
							<td>Alles</td>
							<td>"Hallo Welt" -> "Hallo Welt"</td>
						</tr>
						<tr>
							<td><code class="bg-surface px-1 rounded">(\d+)</code></td>
							<td>Zahlen</td>
							<td>"Episode 123" -> "123"</td>
						</tr>
						<tr>
							<td><code class="bg-surface px-1 rounded">^(.+?) \(</code></td>
							<td>Bis zur ersten Klammer</td>
							<td>"Titel (S01)" -> "Titel"</td>
						</tr>
						<tr>
							<td><code class="bg-surface px-1 rounded">(?&lt;=: )(.+)</code></td>
							<td>Nach Doppelpunkt</td>
							<td>"Tatort: Mord" -> "Mord"</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</details>

</div>
