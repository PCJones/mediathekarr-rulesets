<script lang="ts">
	import { onMount } from 'svelte';
	import { isAuthenticated, isAdmin } from '$stores/auth';
	import { getAllMedia } from '$api/media';
	import type { Media } from '$types';
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	let recentMedia = $state<Media[]>([]);
	let isLoadingMedia = $state(false);

	onMount(async () => {
		isLoadingMedia = true;
		try {
			const allMedia = await getAllMedia();
			recentMedia = allMedia.slice(0, 6);
		} catch {
			// Silently fail — recent shows section is optional
		} finally {
			isLoadingMedia = false;
		}
	});
</script>

<svelte:head>
	<title>MediathekArr Rulesets</title>
	<meta name="description" content="Erstelle und verwalte Rulesets für MediathekArr" />
</svelte:head>

<div class="space-y-10">
	<!-- Hero -->
	<section class="py-8 text-center">
		<h1 class="text-3xl md:text-4xl font-bold">MediathekArr Rulesets</h1>
		<p class="mt-3 text-lg text-text-secondary max-w-2xl mx-auto">
			Erstelle Rulesets, um Mediathek-Inhalte automatisch mit TVDB-Episoden zu verknüpfen.
			Teste deine Regeln live gegen die MediathekViewWeb API.
		</p>
		<div class="flex flex-wrap gap-3 justify-center mt-6">
			{#if $isAdmin}
				<Button variant="primary" size="lg" href="/media">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
					</svg>
					Media verwalten
				</Button>
			{:else}
				<Button variant="primary" size="lg" href="/media">
					Media durchsuchen
				</Button>
			{/if}
			<Button size="lg" href="/suggestions">
				Vorschläge ansehen
			</Button>
		</div>
	</section>

	<!-- Feature cards -->
	<section class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<Card>
			<div class="flex items-start gap-3">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				</svg>
				<div>
					<h3 class="font-semibold">Schritt-für-Schritt Wizard</h3>
					<p class="mt-1 text-sm text-text-secondary">
						Erstelle Rulesets mit einem geführten Assistenten: Topics definieren, Filter setzen, Matching-Strategie wählen.
					</p>
				</div>
			</div>
		</Card>

		<Card>
			<div class="flex items-start gap-3">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
				</svg>
				<div>
					<h3 class="font-semibold">Live-Sandbox</h3>
					<p class="mt-1 text-sm text-text-secondary">
						Teste Suchanfragen in Echtzeit gegen echte MediathekViewWeb-Daten mit detaillierter Vorschau.
					</p>
				</div>
			</div>
		</Card>

		<Card>
			<div class="flex items-start gap-3">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				<div>
					<h3 class="font-semibold">TVDB-Integration</h3>
					<p class="mt-1 text-sm text-text-secondary">
						Automatische Verknüpfung mit TVDB-Episoden durch verschiedene Matching-Strategien.
					</p>
				</div>
			</div>
		</Card>
	</section>

	<!-- Recent shows -->
	{#if recentMedia.length > 0 || isLoadingMedia}
		<section>
			<h2 class="text-xl font-semibold mb-4">Aktuelle Shows</h2>
			{#if isLoadingMedia}
				<div class="flex justify-center py-8">
					<Spinner />
				</div>
			{:else}
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
					{#each recentMedia as media}
						<a
							href="/media/{media.id}/rulesets"
							class="card p-3 text-center hover:border-accent transition-colors group"
						>
							<div class="h-16 flex items-center justify-center mb-2">
								{#if media.tvdbId}
									<img
										src="https://artworks.thetvdb.com/banners/posters/{media.tvdbId}-1.jpg"
										alt={media.name}
										class="h-full w-auto rounded object-cover"
										onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
									/>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
									</svg>
								{/if}
							</div>
							<p class="text-xs font-medium truncate group-hover:text-accent transition-colors">{media.name}</p>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>
