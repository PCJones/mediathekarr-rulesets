<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$components/ui/Button.svelte';

	let status = $derived($page.status);
	let message = $derived(
		status === 404
			? 'Diese Seite gibt es nicht (mehr).'
			: $page.error?.message || 'Ein unerwarteter Fehler ist aufgetreten.'
	);
</script>

<svelte:head>
	<title>{status} - MediathekArr</title>
</svelte:head>

<div class="min-h-[60vh] flex items-center justify-center text-center">
	<div>
		<p class="text-6xl font-bold text-accent">{status}</p>
		<p class="mt-3 text-lg text-text-secondary">{message}</p>
		<div class="mt-6 flex gap-3 justify-center">
			<Button variant="primary" href="/">Zur Startseite</Button>
			<Button href="/media">Media durchsuchen</Button>
		</div>
	</div>
</div>
