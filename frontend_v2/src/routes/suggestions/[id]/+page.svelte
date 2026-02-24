<script lang="ts">
	import { page } from '$app/stores';
	import { getSuggestion, updateSuggestionStatus } from '$api/suggestions';
	import { authStore, isAdmin, isUser } from '$stores/auth';
	import VoteWidget from '$components/suggestions/VoteWidget.svelte';
	import CommentSection from '$components/suggestions/CommentSection.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Alert from '$components/ui/Alert.svelte';

	let refreshCounter = $state(0);
	let resolutionComment = $state('');
	let showResolveForm = $state<'accepted' | 'rejected' | null>(null);

	let suggestion = $derived.by(() => {
		refreshCounter;
		return getSuggestion(Number($page.params.id));
	});
	let error = $derived(!suggestion ? 'Vorschlag nicht gefunden' : null);

	function refresh() {
		refreshCounter++;
	}

	let statusVariant = $derived(
		suggestion?.status === 'accepted' ? 'success' as const :
		suggestion?.status === 'rejected' ? 'error' as const : 'info' as const
	);

	let statusLabel = $derived(
		suggestion?.status === 'accepted' ? 'Angenommen' :
		suggestion?.status === 'rejected' ? 'Abgelehnt' : 'Offen'
	);

	let currentUserId = $derived($authStore.user?.email ?? null);

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleResolve(status: 'accepted' | 'rejected') {
		if (!suggestion || !currentUserId) return;

		updateSuggestionStatus(
			suggestion.id,
			status,
			currentUserId,
			resolutionComment.trim() || undefined
		);

		resolutionComment = '';
		showResolveForm = null;
		refresh();
	}

	const strategyLabels: Record<string, string> = {
		'SeasonAndEpisodeNumber': 'Season + Episode',
		'AbsoluteEpisodeNumber': 'Absolute Episode',
		'ItemTitleEqualsEpisodeName': 'Titel = Episodenname',
		'ItemTitleIncludes': 'Titel enthält',
		'ItemTitleEqualsAirdate': 'Airdate Matching'
	};
</script>

<svelte:head>
	<title>{suggestion?.title || 'Vorschlag'} - MediathekArr</title>
</svelte:head>

<div class="space-y-6">
	<!-- Back nav -->
	<a href="/suggestions" class="btn btn-ghost btn-sm">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
		</svg>
		Zurück zu Vorschläge
	</a>

	{#if error}
		<Alert variant="error">{error}</Alert>
	{:else if suggestion}
		<!-- Header -->
		<div class="flex flex-col md:flex-row items-start gap-4">
			{#if currentUserId}
				<VoteWidget {suggestion} userId={currentUserId} onVoteChanged={refresh} />
			{/if}

			<div class="flex-1 min-w-0">
				<div class="flex flex-wrap items-center gap-2 mb-2">
					<Badge variant={statusVariant}>{statusLabel}</Badge>
					<span class="text-sm text-text-tertiary">#{suggestion.id}</span>
				</div>
				<h1 class="text-2xl font-bold">{suggestion.title}</h1>
				<div class="flex flex-wrap items-center gap-3 mt-2 text-sm text-text-tertiary">
					<span>von <span class="text-text-secondary font-medium">{suggestion.author}</span></span>
					<span>{formatDate(suggestion.createdAt)}</span>
					<a href="/media/{suggestion.media.id}/rulesets" class="text-accent hover:underline">
						{suggestion.media.name}
					</a>
				</div>
			</div>
		</div>

		<!-- Description -->
		<div class="card p-5">
			<h2 class="font-semibold mb-2">Beschreibung</h2>
			<p class="text-text-secondary whitespace-pre-wrap">{suggestion.description}</p>
		</div>

		<!-- Proposed Ruleset Config -->
		<div class="card p-5">
			<h2 class="font-semibold mb-3">Vorgeschlagenes Ruleset</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
				<div>
					<span class="text-text-tertiary">Topic</span>
					<p class="font-mono font-medium">{suggestion.proposedRuleset.topic}</p>
				</div>
				<div>
					<span class="text-text-tertiary">Strategie</span>
					<p class="font-medium">{strategyLabels[suggestion.proposedRuleset.matchingStrategy] || suggestion.proposedRuleset.matchingStrategy}</p>
				</div>
				{#if suggestion.proposedRuleset.tvdbId}
					<div>
						<span class="text-text-tertiary">TVDB ID</span>
						<p class="font-mono">{suggestion.proposedRuleset.tvdbId}</p>
					</div>
				{/if}
				<div>
					<span class="text-text-tertiary">Priorität</span>
					<p>{suggestion.proposedRuleset.priority}</p>
				</div>

				{#if suggestion.proposedRuleset.filters.length > 0}
					<div class="sm:col-span-2">
						<span class="text-text-tertiary">Filter</span>
						<div class="flex flex-wrap gap-1.5 mt-1">
							{#each suggestion.proposedRuleset.filters as filter}
								<span class="badge badge-sm">
									{filter.attribute} {filter.type} <span class="font-mono">{filter.value}</span>
								</span>
							{/each}
						</div>
					</div>
				{/if}

				{#if suggestion.proposedRuleset.titleRegexRules.length > 0}
					<div class="sm:col-span-2">
						<span class="text-text-tertiary">Titel-Regeln</span>
						<div class="space-y-1 mt-1">
							{#each suggestion.proposedRuleset.titleRegexRules as rule}
								<p class="font-mono text-xs bg-surface-raised px-2 py-1 rounded border border-border">
									{rule.field}: {rule.pattern}
								</p>
							{/each}
						</div>
					</div>
				{/if}

				{#if suggestion.proposedRuleset.seasonRegex}
					<div>
						<span class="text-text-tertiary">Season Regex</span>
						<p class="font-mono text-xs bg-surface-raised px-2 py-1 rounded border border-border inline-block mt-1">
							{suggestion.proposedRuleset.seasonRegex}
						</p>
					</div>
				{/if}

				{#if suggestion.proposedRuleset.episodeRegex}
					<div>
						<span class="text-text-tertiary">Episode Regex</span>
						<p class="font-mono text-xs bg-surface-raised px-2 py-1 rounded border border-border inline-block mt-1">
							{suggestion.proposedRuleset.episodeRegex}
						</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Test Results -->
		<div class="card p-5">
			<h2 class="font-semibold mb-3">Testergebnisse</h2>
			<div class="flex flex-wrap gap-4 mb-4">
				<div class="text-center">
					<p class="text-2xl font-bold" class:text-success={suggestion.testResults.matchRate >= 80} class:text-warning={suggestion.testResults.matchRate >= 50 && suggestion.testResults.matchRate < 80} class:text-error={suggestion.testResults.matchRate < 50}>
						{suggestion.testResults.matchRate}%
					</p>
					<p class="text-xs text-text-tertiary">Match-Rate</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-bold">{suggestion.testResults.matchedItems}</p>
					<p class="text-xs text-text-tertiary">Matches</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-bold text-text-secondary">{suggestion.testResults.totalItems}</p>
					<p class="text-xs text-text-tertiary">Gesamt</p>
				</div>
			</div>

			{#if suggestion.testResults.sampleMatches.length > 0}
				<h3 class="text-sm font-medium mb-2">Beispiel-Matches</h3>
				<div class="overflow-x-auto border border-border rounded-lg">
					<table class="data-table w-full">
						<thead>
							<tr>
								<th>Originaltitel</th>
								<th>Konstruiert</th>
								<th>TVDB Episode</th>
							</tr>
						</thead>
						<tbody>
							{#each suggestion.testResults.sampleMatches as match}
								<tr>
									<td class="font-mono text-xs">{match.title}</td>
									<td class="font-mono text-xs">{match.constructedTitle}</td>
									<td class="font-mono text-xs">
										{#if match.tvdbEpisode}
											<span class="text-success">{match.tvdbEpisode}</span>
										{:else}
											<span class="text-text-tertiary">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Resolution info (if resolved) -->
		{#if suggestion.resolvedBy}
			<div class="card p-5">
				<div class="flex items-center gap-2 mb-2">
					<Badge variant={suggestion.status === 'accepted' ? 'success' : 'error'}>
						{suggestion.status === 'accepted' ? 'Angenommen' : 'Abgelehnt'}
					</Badge>
					<span class="text-sm text-text-tertiary">
						von {suggestion.resolvedBy} am {formatDate(suggestion.updatedAt)}
					</span>
				</div>
				{#if suggestion.resolutionComment}
					<p class="text-sm text-text-secondary">{suggestion.resolutionComment}</p>
				{/if}
			</div>
		{/if}

		<!-- Admin actions -->
		{#if $isAdmin && suggestion.status === 'open'}
			<div class="card p-5">
				<h2 class="font-semibold mb-3">Admin-Aktionen</h2>

				{#if showResolveForm}
					<div class="space-y-3">
						<p class="text-sm text-text-secondary">
							{showResolveForm === 'accepted' ? 'Vorschlag annehmen' : 'Vorschlag ablehnen'} — optionaler Kommentar:
						</p>
						<textarea
							class="input min-h-[80px] resize-y"
							placeholder="Begründung (optional)..."
							bind:value={resolutionComment}
						></textarea>
						<div class="flex gap-2">
							<Button
								variant={showResolveForm === 'accepted' ? 'primary' : 'danger'}
								onclick={() => handleResolve(showResolveForm!)}
							>
								{showResolveForm === 'accepted' ? 'Annehmen' : 'Ablehnen'}
							</Button>
							<Button variant="ghost" onclick={() => { showResolveForm = null; resolutionComment = ''; }}>
								Abbrechen
							</Button>
						</div>
					</div>
				{:else}
					<div class="flex gap-2">
						<Button variant="primary" onclick={() => showResolveForm = 'accepted'}>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
							Annehmen
						</Button>
						<Button variant="danger" onclick={() => showResolveForm = 'rejected'}>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
							</svg>
							Ablehnen
						</Button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Comments -->
		<div class="card p-5">
			<CommentSection
				comments={suggestion.comments}
				suggestionId={suggestion.id}
				currentUser={$isUser || $isAdmin ? currentUserId : null}
				onCommentAdded={refresh}
			/>
		</div>
	{/if}
</div>
