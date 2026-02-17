<script lang="ts">
	// Home page - Dashboard
</script>

<svelte:head>
	<title>MediathekArr Rulesets</title>
	<meta name="description" content="Erstelle und verwalte Rulesets für MediathekArr" />
</svelte:head>

<div class="hero min-h-[60vh]">
	<div class="hero-content text-center">
		<div class="max-w-2xl">
			<h1 class="text-4xl md:text-5xl font-bold">MediathekArr Rulesets</h1>
			<p class="py-6 text-lg text-base-content/70">
				Erstelle Rulesets, um Mediathek-Inhalte automatisch mit TVDB-Episoden zu verknüpfen.
				Teste deine Regeln live gegen die MediathekViewWeb API.
			</p>
			<div class="flex flex-wrap gap-4 justify-center">
				<a href="/media" class="btn btn-primary btn-lg">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
					</svg>
					Media verwalten
				</a>
				<a href="/sandbox" class="btn btn-outline btn-lg">
					Sandbox testen
				</a>
			</div>
		</div>
	</div>
</div>

<!-- Quick stats / features -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				</svg>
				Schritt-für-Schritt Wizard
			</h2>
			<p class="text-base-content/70">
				Erstelle Rulesets mit einem geführten Assistenten: Show auswählen, Filter definieren, Titel-Regeln erstellen.
			</p>
		</div>
	</div>

	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
				</svg>
				Live-Sandbox
			</h2>
			<p class="text-base-content/70">
				Teste deine Regeln in Echtzeit gegen echte MediathekViewWeb-Daten mit detailliertem Debug-Output.
			</p>
		</div>
	</div>

	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				TVDB-Integration
			</h2>
			<p class="text-base-content/70">
				Automatische Verknüpfung mit TVDB-Episoden durch verschiedene Matching-Strategien.
			</p>
		</div>
	</div>
</div>
