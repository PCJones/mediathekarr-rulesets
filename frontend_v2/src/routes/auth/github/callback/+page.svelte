<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { finishGithubLogin } from '$api/auth';
	import { authStore } from '$stores/auth';
	import Card from '$components/ui/Card.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';
	import Button from '$components/ui/Button.svelte';

	let error = $state<string | null>(null);

	onMount(async () => {
		const params = $page.url.searchParams;
		const code = params.get('code');
		const state = params.get('state');
		const ghError = params.get('error_description') || params.get('error');

		if (ghError) {
			error = `GitHub: ${ghError}`;
			return;
		}
		if (!code || !state) {
			error = 'Ungültige Antwort von GitHub.';
			return;
		}

		try {
			await finishGithubLogin(code, state);
			authStore.init();
			goto('/media', { replaceState: true });
		} catch (e) {
			error = e instanceof Error ? e.message : 'GitHub-Login fehlgeschlagen';
		}
	});
</script>

<svelte:head>
	<title>GitHub Login - MediathekArr</title>
</svelte:head>

<div class="min-h-[60vh] flex items-center justify-center">
	<div class="w-full max-w-md">
		<Card padding="lg">
			{#if error}
				<Alert variant="error">{error}</Alert>
				<div class="mt-4 text-center">
					<Button href="/login">Zurück zum Login</Button>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-3 py-6 text-text-secondary">
					<Spinner />
					<span>Anmeldung mit GitHub …</span>
				</div>
			{/if}
		</Card>
	</div>
</div>
