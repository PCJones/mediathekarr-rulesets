<script lang="ts">
	import type { Filter, RegexRule } from '$types/ruleset';
	import { strategyLabel } from '$types/ruleset';
	import type { ChangeOp, RulesetBodySource } from '$types/suggestion';

	interface Props {
		op: ChangeOp;
		base?: RulesetBodySource | null;
		ruleset?: RulesetBodySource | null;
		/** Topic and strategy are already shown by the surrounding header. */
		omitHeaderFields?: boolean;
	}

	let { op, base = null, ruleset = null, omitHeaderFields = false }: Props = $props();

	const headerFields = ['Topic', 'Strategie'];

	type ListRow = { state: 'same' | 'added' | 'removed'; text: string };
	type Field =
		| { label: string; kind: 'scalar'; mono: boolean; changed: boolean; oldValue: string; newValue: string }
		| { label: string; kind: 'list'; changed: boolean; rows: ListRow[] };

	const attributeLabels: Record<string, string> = {
		duration: 'Dauer',
		channel: 'Sender',
		topic: 'Topic',
		title: 'Titel',
		description: 'Beschreibung'
	};

	const operatorLabels: Record<string, string> = {
		GreaterThan: '>',
		LessThan: '<',
		Equals: '=',
		Contains: 'enthält',
		Regex: 'matcht'
	};

	function filterText(f: Filter): string {
		const attribute = attributeLabels[f.attribute] ?? f.attribute;
		const operator = operatorLabels[f.type] ?? f.type;
		if (f.attribute === 'duration') return `${attribute} ${operator} ${f.value} Min.`;
		if (f.type === 'Regex') return `${attribute} ${operator} /${f.value}/`;
		return `${attribute} ${operator} „${f.value}“`;
	}

	function ruleText(r: RegexRule): string {
		return r.type === 'static' ? `static "${r.value ?? ''}"` : `regex ${r.field ?? 'title'} ${r.pattern ?? ''}`;
	}

	function scalar(
		label: string,
		mono: boolean,
		oldValue: string | null | undefined,
		newValue: string | null | undefined
	): Field {
		const oldText = oldValue || '–';
		const newText = newValue || '–';
		return { label, kind: 'scalar', mono, changed: oldText !== newText, oldValue: oldText, newValue: newText };
	}

	/** `ordered`: the sequence matters (title rules build the title step by step), so a reorder is a change. */
	function list<T>(
		label: string,
		oldItems: T[],
		newItems: T[],
		text: (item: T) => string,
		ordered = false
	): Field {
		const oldTexts = oldItems.map(text);
		const newTexts = newItems.map(text);
		const rows: ListRow[] = [];

		const keptOld = oldTexts.filter((t) => newTexts.includes(t));
		const keptNew = newTexts.filter((t) => oldTexts.includes(t));
		if (ordered && keptOld.join('\n') !== keptNew.join('\n')) {
			for (const t of oldTexts) rows.push({ state: 'removed', text: t });
			for (const t of newTexts) rows.push({ state: 'added', text: t });
			return { label, kind: 'list', changed: true, rows };
		}

		for (const t of oldTexts) {
			if (!newTexts.includes(t)) rows.push({ state: 'removed', text: t });
		}
		for (const t of newTexts) {
			rows.push({ state: oldTexts.includes(t) ? 'same' : 'added', text: t });
		}

		return { label, kind: 'list', changed: rows.some((r) => r.state !== 'same'), rows };
	}

	function plainFields(source: RulesetBodySource): Field[] {
		return [
			scalar('Topic', true, source.topic, source.topic),
			scalar('Strategie', false, strategyLabel(source.matchingStrategy), strategyLabel(source.matchingStrategy)),
			scalar('Season-Regex', true, source.seasonRegex, source.seasonRegex),
			scalar('Episode-Regex', true, source.episodeRegex, source.episodeRegex),
			list('Filter', [], source.filters ?? [], filterText),
			list('Titelregeln', [], source.titleRegexRules ?? [], ruleText)
		];
	}

	function diffFields(from: RulesetBodySource, to: RulesetBodySource): Field[] {
		return [
			scalar('Topic', true, from.topic, to.topic),
			scalar('Strategie', false, strategyLabel(from.matchingStrategy), strategyLabel(to.matchingStrategy)),
			scalar('Season-Regex', true, from.seasonRegex, to.seasonRegex),
			scalar('Episode-Regex', true, from.episodeRegex, to.episodeRegex),
			list('Filter', from.filters ?? [], to.filters ?? [], filterText),
			list('Titelregeln', from.titleRegexRules ?? [], to.titleRegexRules ?? [], ruleText, true)
		];
	}

	let isPlain = $derived(op !== 'update' || !base || !ruleset);
	let plainSource = $derived(op === 'delete' ? base : (ruleset ?? base));

	let fields = $derived(
		isPlain
			? plainSource
				? plainFields(plainSource)
				: []
			: diffFields(base!, ruleset!)
	);

	function isEmpty(field: Field): boolean {
		return field.kind === 'scalar' ? field.newValue === '–' : field.rows.length === 0;
	}

	let changedFields = $derived(
		isPlain
			? fields.filter(
					(f) => !isEmpty(f) && !(omitHeaderFields && headerFields.includes(f.label))
				)
			: fields.filter((f) => f.changed)
	);
	let unchangedFields = $derived(
		isPlain
			? []
			: fields.filter(
					(f) => !f.changed && !isEmpty(f) && !(omitHeaderFields && headerFields.includes(f.label))
				)
	);

	let showUnchanged = $state(false);

	type Tone = 'old' | 'new' | 'same';

	let plainTone = $derived<Tone>(op === 'create' ? 'new' : op === 'delete' ? 'old' : 'same');

	const marks: Record<Tone, string> = { old: '−', new: '+', same: '' };

	function isMono(field: Field): boolean {
		return field.kind === 'list' ? field.label === 'Titelregeln' : field.mono;
	}
</script>

{#snippet line(tone: Tone, label: string, value: string, mono: boolean)}
	<div class="diff-line" class:diff-line-old={tone === 'old'} class:diff-line-new={tone === 'new'}>
		<span class="text-center font-mono" class:text-error={tone === 'old'} class:text-success={tone === 'new'}>
			{marks[tone]}
		</span>
		<span class="text-xs leading-5 text-text-secondary">{label}</span>
		<span class="min-w-0 break-words" class:font-mono={mono} class:line-through={tone === 'old' && op !== 'delete'}>
			{value}
		</span>
	</div>
{/snippet}

{#snippet fieldLines(field: Field, tone: Tone | null)}
	{#if field.kind === 'scalar'}
		{#if tone || !field.changed}
			{@render line(tone ?? 'same', field.label, field.newValue, field.mono)}
		{:else}
			{@render line('old', field.label, field.oldValue, field.mono)}
			{@render line('new', '', field.newValue, field.mono)}
		{/if}
	{:else if field.rows.length === 0}
		{@render line(tone ?? 'same', field.label, '–', false)}
	{:else}
		{#each field.rows as row, index}
			{@render line(
				tone ?? (row.state === 'removed' ? 'old' : row.state === 'added' ? 'new' : 'same'),
				index === 0 ? field.label : '',
				row.text,
				isMono(field)
			)}
		{/each}
	{/if}
{/snippet}

<div class="text-[0.8125rem]">
	{#each changedFields as field (field.label)}
		{@render fieldLines(field, isPlain ? plainTone : null)}
	{/each}

	{#if changedFields.length === 0 && !isPlain}
		<p class="px-3 py-1.5 text-xs text-text-tertiary">Keine Feldänderungen.</p>
	{/if}

	{#if showUnchanged}
		{#each unchangedFields as field (field.label)}
			{@render fieldLines(field, 'same')}
		{/each}
	{/if}

	{#if unchangedFields.length > 0}
		<button
			type="button"
			class="block w-full py-1.5 pl-7 text-left text-xs text-text-tertiary hover:text-text-secondary transition-colors"
			onclick={() => (showUnchanged = !showUnchanged)}
		>
			{showUnchanged
				? 'Unveränderte Felder ausblenden'
				: unchangedFields.length === 1
					? '1 unverändertes Feld anzeigen'
					: `${unchangedFields.length} unveränderte Felder anzeigen`}
		</button>
	{/if}
</div>
