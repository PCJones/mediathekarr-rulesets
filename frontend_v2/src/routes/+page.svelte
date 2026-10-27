<script lang="ts">
	import { onMount } from 'svelte';
	import { getAllMedia } from '$api/media';
	import type { Media } from '$types';
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
	<meta name="description" content="Rulesets für MediathekArr" />
</svelte:head>

<div class="space-y-8">
	<!-- Hero -->
	<section class="text-center">
		<img
			src="/logo-ard.png"
			alt=""
			class="h-14 w-auto mx-auto mb-1 logo-adaptive opacity-80"
		/>
		<h1 class="text-3xl md:text-4xl font-bold">MediathekArr Rulesets</h1>
		<div class="mt-3 max-w-2xl mx-auto space-y-3">
			<p class="text-lg">
				Rulesets für
				<a href="https://github.com/PCJones/MediathekArr" target="_blank" rel="noopener" class="text-accent hover:underline">MediathekArr</a>.
				MediathekArr bindet die ARD- und ZDF-Mediatheken in Sonarr, Radarr und Prowlarr ein.
			</p>
			<p>
				Die Mediatheken benennen Sendungen nicht einheitlich. Ein Ruleset legt pro Serie fest,
				welche Mediathek-Einträge dazugehören und wie sie den TVDB-Episoden zugeordnet werden.
				MediathekArr lädt die Rulesets von hier.
			</p>
			<p>
				Die Rulesets werden von der Community gepflegt. Wenn eine Serie fehlt oder falsch
				zugeordnet wird, kannst du nach dem Login ein Ruleset erstellen oder ändern und als
				Vorschlag einreichen. Vorschläge von anderen kannst du bewerten und kommentieren. Nach
				einem Review werden sie übernommen und stehen dann allen MediathekArr-Nutzern zur
				Verfügung.
			</p>
		</div>
		<div class="flex flex-wrap gap-3 justify-center mt-6">
			<Button variant="primary" href="/media">Serien</Button>
			<Button href="/suggestions">Vorschläge</Button>
		</div>
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

	<!-- Credits + contact -->
	<section class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div class="card p-5 md:col-span-2 flex flex-col sm:flex-row items-start gap-4">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
			</svg>
			<div class="text-sm">
				<h2 class="font-semibold text-base">Danke an MediathekViewWeb</h2>
				<p class="mt-1">
					Alle Mediathek-Daten in dieser App stammen aus der API von
					<a href="https://mediathekviewweb.de" target="_blank" rel="noopener" class="text-accent hover:underline font-medium">mediathekviewweb.de</a>,
					einem Projekt aus der
					<a href="https://mediathekview.de" target="_blank" rel="noopener" class="text-accent hover:underline">MediathekView</a>-Community.
					Ohne diese Schnittstelle gäbe es weder MediathekArr noch diese Ruleset-Verwaltung.
					Bitte unterstützt das Projekt, wenn ihr könnt.
				</p>
				<p class="mt-3">
					Danke auch an
					<a href="https://thetvdb.com" target="_blank" rel="noopener" class="text-accent hover:underline">TheTVDB</a>
					für die Serien- und Episodendaten.
				</p>
			</div>
		</div>

		<div class="card p-5 text-sm">
			<h2 class="font-semibold text-base">Hilfe &amp; Kontakt</h2>
			<ul class="mt-2 space-y-1.5">
				<li>
					<a href="https://github.com/PCJones/MediathekArr/issues" target="_blank" rel="noopener" class="text-accent hover:underline font-medium">GitHub Issues</a>:
					Bugs und Wünsche
				</li>
				<li>
					<a href="https://discord.gg/src6zcH4rr" target="_blank" rel="noopener" class="text-accent hover:underline font-medium">Discord</a>:
					#mediathekarr auf dem UsenetDE-Server
				</li>
				<li>
					<a href="https://t.me/pc_jones" target="_blank" rel="noopener" class="text-accent hover:underline font-medium">Telegram</a>
				</li>
			</ul>
		</div>
	</section>

	<p class="text-sm text-center pb-4">
		MediathekArr unterstützen:
		<a href="https://www.buymeacoffee.com/pcjones" target="_blank" rel="noopener" class="text-accent hover:underline">Buy Me a Coffee</a>
		·
		<a href="https://coindrop.to/pcjones" target="_blank" rel="noopener" class="text-accent hover:underline">Coindrop</a>
	</p>
</div>
