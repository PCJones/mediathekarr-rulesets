<script lang="ts">
	import { getRulesetChangelog } from '$api/rulesets';
	import type { RulesetChangelogEntry } from '$types';
	import Modal from '$components/ui/Modal.svelte';
	import Spinner from '$components/ui/Spinner.svelte';
	import Alert from '$components/ui/Alert.svelte';

	interface Props {
		open?: boolean;
		rulesetId: number;
		rulesetTopic?: string;
	}

	let { open = $bindable(false), rulesetId, rulesetTopic }: Props = $props();

	let entries = $state<RulesetChangelogEntry[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		const id = rulesetId;
		isLoading = true;
		error = null;
		getRulesetChangelog(id)
			.then((list) => { entries = list; })
			.catch((e) => { error = e instanceof Error ? e.message : 'Verlauf konnte nicht geladen werden'; })
			.finally(() => { isLoading = false; });
	});

	function formatDate(value: string): string {
		const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
		return date.toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<Modal bind:open title={rulesetTopic ? `Verlauf: ${rulesetTopic}` : 'Verlauf'}>
	{#if isLoading}
		<div class="flex justify-center py-8">
			<Spinner />
		</div>
	{:else if error}
		<Alert variant="error">{error}</Alert>
	{:else if entries.length === 0}
		<p class="py-6 text-center text-sm text-text-secondary">Noch keine Änderungen aufgezeichnet.</p>
	{:else}
		<ol class="divide-y divide-border">
			{#each entries as entry (entry.id)}
				<li class="py-3">
					<p class="text-sm">{entry.changeSummary}</p>
					<p class="mt-1 text-xs text-text-tertiary">
						{formatDate(entry.changedAt)} · {entry.changedBy}
					</p>
				</li>
			{/each}
		</ol>
	{/if}
</Modal>
