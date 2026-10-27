<script lang="ts">
	import { getSuggestionRevision } from '$api/suggestions';
	import type {
		ChangeOp,
		RevisionRef,
		RulesetBody,
		SuggestionChange,
		SuggestionComment,
		SuggestionRevision
	} from '$types/suggestion';
	import { formatDate, formatRelative, parseApiDate } from '$utils/time';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';
	import Avatar from './Avatar.svelte';
	import CommentItem from './CommentItem.svelte';
	import RulesetDiff from './RulesetDiff.svelte';

	interface Props {
		suggestionId: number;
		revisions: RevisionRef[];
		author: string;
		description: string;
		createdAt: string;
		comments: SuggestionComment[];
		onCommentUpdated: (comment: SuggestionComment) => void;
		onCommentRemoved: () => void;
	}

	let {
		suggestionId,
		revisions,
		author,
		description,
		createdAt,
		comments,
		onCommentUpdated,
		onCommentRemoved
	}: Props = $props();

	let ordered = $derived([...revisions].sort((a, b) => a.number - b.number));

	type TimelineItem =
		| { kind: 'revision'; at: number; index: number }
		| { kind: 'comment'; at: number; comment: SuggestionComment };

	function timestamp(value: string): number {
		return parseApiDate(value)?.getTime() ?? 0;
	}

	let items = $derived.by((): TimelineItem[] => {
		const all: TimelineItem[] = [
			...ordered.map((r, index) => ({ kind: 'revision' as const, at: timestamp(r.createdAt), index })),
			...comments.map((comment) => ({ kind: 'comment' as const, at: timestamp(comment.createdAt), comment }))
		];
		return all.sort((a, b) => a.at - b.at || (a.kind === 'revision' ? -1 : 1));
	});

	let loaded = $state<Map<number, SuggestionRevision>>(new Map());
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const numbers = revisions.map((r) => r.number);
		const id = suggestionId;
		let cancelled = false;
		isLoading = true;
		error = null;
		Promise.all(numbers.map((n) => getSuggestionRevision(id, n)))
			.then((result) => {
				if (!cancelled) loaded = new Map(result.map((r) => [r.number, r]));
			})
			.catch((e) => {
				if (!cancelled) error = e instanceof Error ? e.message : 'Verlauf konnte nicht geladen werden';
			})
			.finally(() => {
				if (!cancelled) isLoading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	type Mark = '+' | '~' | '−';

	type Entry = {
		key: string;
		mark: Mark;
		text: string;
		topic?: string;
		detail?:
			| { kind: 'ruleset'; op: ChangeOp; base: RulesetBody | null; ruleset: RulesetBody | null }
			| { kind: 'text'; before: string; after: string; mono: boolean };
	};

	const markTone: Record<Mark, string> = {
		'+': 'text-success',
		'~': 'text-info',
		'−': 'text-error'
	};

	const opMark: Record<ChangeOp, Mark> = { create: '+', update: '~', delete: '−' };

	const opNoun: Record<ChangeOp, string> = {
		create: 'Neues Ruleset',
		update: 'Änderung an',
		delete: 'Löschung von'
	};

	const opShort: Record<ChangeOp, string> = {
		create: 'Neues Ruleset',
		update: 'Änderung',
		delete: 'Löschung'
	};

	function bodyOf(change: SuggestionChange): RulesetBody | null {
		return change.ruleset ?? change.base?.ruleset ?? null;
	}

	function topicOf(change: SuggestionChange): string {
		return bodyOf(change)?.topic ?? change.key;
	}

	function refLabel(ref: string, revision: SuggestionRevision): string {
		const change = revision.bundle.changes.find(
			(c) => c.key === ref || String(c.rulesetId) === ref
		);
		return change ? topicOf(change) : `#${ref}`;
	}

	function orderText(revision: SuggestionRevision): string {
		const order = revision.bundle.order ?? [];
		return order.length > 0
			? order.map((ref, i) => `${i + 1}. ${refLabel(ref, revision)}`).join('\n')
			: 'Live-Reihenfolge';
	}

	function initial(revision: SuggestionRevision): Entry[] {
		return revision.bundle.changes.map((change) => ({
			key: change.key,
			mark: opMark[change.op],
			text: opNoun[change.op],
			topic: topicOf(change)
		}));
	}

	function compare(a: SuggestionRevision, b: SuggestionRevision): Entry[] {
		const before = new Map(a.bundle.changes.map((c) => [c.key, c]));
		const after = new Map(b.bundle.changes.map((c) => [c.key, c]));
		const entries: Entry[] = [];

		for (const [key, change] of after) {
			const old = before.get(key);
			const topic = topicOf(change);
			if (!old) {
				entries.push({
					key,
					mark: opMark[change.op],
					text: opNoun[change.op],
					topic,
					detail: {
						kind: 'ruleset',
						op: change.op,
						base: change.op === 'create' ? null : (change.base?.ruleset ?? null),
						ruleset: change.op === 'delete' ? null : (change.ruleset ?? null)
					}
				});
				continue;
			}
			const oldBody = bodyOf(old);
			const newBody = bodyOf(change);
			if (old.op === change.op && JSON.stringify(oldBody) === JSON.stringify(newBody)) continue;
			entries.push({
				key,
				mark: '~',
				text: old.op === change.op ? 'Überarbeitet:' : `Jetzt ${opShort[change.op]} statt ${opShort[old.op]}:`,
				topic,
				detail: { kind: 'ruleset', op: 'update', base: oldBody, ruleset: newBody }
			});
		}

		for (const [key, change] of before) {
			if (after.has(key)) continue;
			entries.push({
				key,
				mark: '−',
				text: change.op === 'create' ? 'Neues Ruleset entfernt:' : `${opShort[change.op]} zurückgenommen:`,
				topic: topicOf(change),
				detail: { kind: 'ruleset', op: 'delete', base: bodyOf(change), ruleset: null }
			});
		}

		if (a.description !== b.description) {
			entries.push({
				key: 'description',
				mark: '~',
				text: 'Begründung geändert',
				detail: { kind: 'text', before: a.description, after: b.description, mono: false }
			});
		}

		if (JSON.stringify(a.bundle.order) !== JSON.stringify(b.bundle.order)) {
			entries.push({
				key: 'order',
				mark: '~',
				text: 'Reihenfolge geändert',
				detail: { kind: 'text', before: orderText(a), after: orderText(b), mono: true }
			});
		}

		return entries;
	}

	function entriesFor(index: number): Entry[] | null {
		const current = loaded.get(ordered[index].number);
		if (!current) return null;
		if (index === 0) return initial(current);
		const previous = loaded.get(ordered[index - 1].number);
		return previous ? compare(previous, current) : null;
	}
</script>

<ol class="timeline space-y-5">
	<li class="relative flex gap-3">
		<Avatar name={author} highlight />
		<div class="min-w-0 flex-1 rounded-lg border border-border-strong bg-bg overflow-hidden">
			<div class="flex items-center justify-between gap-2 px-3 py-1.5 bg-surface border-b border-border text-[0.8125rem] text-text-secondary">
				<span>
					<strong class="font-semibold text-text">@{author}</strong> hat den Vorschlag eröffnet ·
					<span title={formatDate(createdAt)}>{formatRelative(createdAt)}</span>
				</span>
				<span class="badge badge-sm">Autor</span>
			</div>
			<p class="px-3 py-2.5 text-sm whitespace-pre-wrap">{description}</p>
		</div>
	</li>

	{#each items as item (item.kind === 'revision' ? `r${item.index}` : `c${item.comment.id}`)}
		{#if item.kind === 'comment'}
			<CommentItem
				{suggestionId}
				comment={item.comment}
				{author}
				onUpdated={onCommentUpdated}
				onRemoved={onCommentRemoved}
			/>
		{:else}
		{@const index = item.index}
		{@const revision = ordered[index]}
		{@const entries = entriesFor(index)}
		<li class="relative flex gap-3 pl-0.5">
			<span class="timeline-dot">
				<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
					<circle cx="8" cy="8" r="2.5" /><path d="M8 1.5v4M8 10.5v4" />
				</svg>
			</span>
			<div class="min-w-0 flex-1 pt-1 space-y-1">
				<p class="text-[0.8125rem] text-text-secondary">
					<strong class="font-semibold text-text">@{revision.author}</strong>
					{index === 0 ? 'hat Revision 1 eingereicht' : `hat Revision ${revision.number} hochgeladen`} ·
					<span title={formatDate(revision.createdAt)}>{formatRelative(revision.createdAt)}</span>
				</p>

				{#if isLoading}
					<Spinner size="sm" />
				{:else if entries && entries.length === 0}
					<p class="text-[0.8125rem] text-text-tertiary">Keine inhaltlichen Änderungen.</p>
				{:else if entries}
					<ul class="space-y-0.5 text-[0.8125rem]">
						{#each entries as entry (entry.key)}
							<li>
								{#if entry.detail}
									<details class="group">
										<summary class="flex items-baseline gap-2 cursor-pointer list-none">
											<span class="font-mono w-3 shrink-0 {markTone[entry.mark]}">{entry.mark}</span>
											<span>
												{entry.text}
												{#if entry.topic}<span class="font-mono">{entry.topic}</span>{/if}
											</span>
											<span class="text-xs text-text-tertiary group-open:hidden">Details ▸</span>
											<span class="text-xs text-text-tertiary hidden group-open:inline">Details ▾</span>
										</summary>
										<div class="mt-1.5 mb-2 ml-5 rounded-lg border border-border overflow-hidden">
											{#if entry.detail.kind === 'ruleset'}
												<RulesetDiff op={entry.detail.op} base={entry.detail.base} ruleset={entry.detail.ruleset} />
											{:else}
												<div class="text-[0.8125rem]" class:font-mono={entry.detail.mono}>
													<div class="diff-line diff-line-old">
														<span class="text-center font-mono text-error">−</span>
														<span class="col-span-2 whitespace-pre-wrap line-through">{entry.detail.before}</span>
													</div>
													<div class="diff-line diff-line-new">
														<span class="text-center font-mono text-success">+</span>
														<span class="col-span-2 whitespace-pre-wrap">{entry.detail.after}</span>
													</div>
												</div>
											{/if}
										</div>
									</details>
								{:else}
									<span class="flex items-baseline gap-2">
										<span class="font-mono w-3 shrink-0 {markTone[entry.mark]}">{entry.mark}</span>
										<span>
											{entry.text}
											{#if entry.topic}<span class="font-mono">{entry.topic}</span>{/if}
										</span>
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</li>
		{/if}
	{/each}

	{#if error}
		<li class="relative pl-14"><Alert variant="error">{error}</Alert></li>
	{/if}
</ol>

<style>
	summary::-webkit-details-marker {
		display: none;
	}
</style>
