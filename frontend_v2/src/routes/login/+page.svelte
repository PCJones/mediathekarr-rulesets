<script lang="ts">
	import { goto } from '$app/navigation';
	import { login, isLoggedIn, getGithubConfig, startGithubLogin } from '$api/auth';
	import { authStore } from '$stores/auth';
	import { onMount } from 'svelte';
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';
	import Input from '$components/ui/Input.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import GithubButton from '$components/auth/GithubButton.svelte';

	let identifier = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let isLoading = $state(false);
	let githubClientId = $state<string | null>(null);

	onMount(async () => {
		if (isLoggedIn()) {
			goto('/media');
			return;
		}
		const cfg = await getGithubConfig();
		if (cfg.enabled) githubClientId = cfg.clientId;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!identifier.trim() || !password.trim()) return;

		isLoading = true;
		error = null;

		try {
			await login(identifier.trim(), password);
			authStore.init();
			goto('/media');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Anmeldung - MediathekArr</title>
</svelte:head>

<div class="min-h-[60vh] flex items-center justify-center">
	<div class="w-full max-w-md">
		<Card padding="lg">
			<h1 class="text-2xl font-bold text-center mb-6">Anmeldung</h1>

			{#if error}
				<div class="mb-4">
					<Alert variant="error">{error}</Alert>
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4">
				<Input
					type="text"
					label="E-Mail oder Benutzername"
					placeholder="E-Mail oder Benutzername"
					bind:value={identifier}
					disabled={isLoading}
				/>

				<Input
					type="password"
					label="Passwort"
					placeholder="Passwort eingeben"
					bind:value={password}
					disabled={isLoading}
				/>

				<Button
					type="submit"
					variant="primary"
					disabled={!identifier.trim() || !password.trim()}
					loading={isLoading}
				>
					Anmelden
				</Button>
			</form>

			{#if githubClientId}
				<div class="my-5 flex items-center gap-3 text-xs text-text-tertiary">
					<span class="h-px flex-1 bg-border"></span>
					oder
					<span class="h-px flex-1 bg-border"></span>
				</div>
				<GithubButton onclick={() => startGithubLogin(githubClientId!)} />
			{/if}

			<p class="mt-6 text-center text-sm text-text-secondary">
				Noch kein Konto? <a href="/register" class="text-accent hover:underline">Registrieren</a>
			</p>
		</Card>
	</div>
</div>
