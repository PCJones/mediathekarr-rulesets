<script lang="ts">
	import { goto } from '$app/navigation';
	import { register, isLoggedIn, getGithubConfig, startGithubLogin } from '$api/auth';
	import { authStore } from '$stores/auth';
	import { onMount } from 'svelte';
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';
	import Input from '$components/ui/Input.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import GithubButton from '$components/auth/GithubButton.svelte';

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let error = $state<string | null>(null);
	let isLoading = $state(false);
	let githubClientId = $state<string | null>(null);

	const usernamePattern = /^[A-Za-z0-9_.-]{3,30}$/;

	let usernameError = $derived(
		username && !usernamePattern.test(username)
			? '3–30 Zeichen: Buchstaben, Ziffern, _ . -'
			: undefined
	);
	let passwordError = $derived(
		password && password.length < 8 ? 'Mindestens 8 Zeichen' : undefined
	);
	let confirmError = $derived(
		passwordConfirm && passwordConfirm !== password ? 'Passwörter stimmen nicht überein' : undefined
	);
	let canSubmit = $derived(
		usernamePattern.test(username) &&
		email.includes('@') &&
		password.length >= 8 &&
		password === passwordConfirm
	);

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
		if (!canSubmit) return;

		isLoading = true;
		error = null;

		try {
			await register(username.trim(), email.trim(), password);
			authStore.init();
			goto('/media');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Registrierung fehlgeschlagen';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Registrieren - MediathekArr</title>
</svelte:head>

<div class="min-h-[60vh] flex items-center justify-center">
	<div class="w-full max-w-md">
		<Card padding="lg">
			<h1 class="text-2xl font-bold text-center mb-2">Registrieren</h1>
			<p class="text-sm text-text-secondary text-center mb-6">
				Mit einem Konto kannst du Media und Rulesets anlegen und bearbeiten.
			</p>

			{#if error}
				<div class="mb-4">
					<Alert variant="error">{error}</Alert>
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4">
				<Input
					type="text"
					label="Benutzername"
					placeholder="z.B. max.mustermann"
					bind:value={username}
					error={usernameError}
					disabled={isLoading}
				/>

				<Input
					type="email"
					label="E-Mail"
					placeholder="E-Mail eingeben"
					bind:value={email}
					disabled={isLoading}
				/>

				<Input
					type="password"
					label="Passwort"
					placeholder="Mindestens 8 Zeichen"
					bind:value={password}
					error={passwordError}
					disabled={isLoading}
				/>

				<Input
					type="password"
					label="Passwort wiederholen"
					placeholder="Passwort wiederholen"
					bind:value={passwordConfirm}
					error={confirmError}
					disabled={isLoading}
				/>

				<Button
					type="submit"
					variant="primary"
					disabled={!canSubmit}
					loading={isLoading}
				>
					Konto erstellen
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
				Schon registriert? <a href="/login" class="text-accent hover:underline">Anmelden</a>
			</p>
		</Card>
	</div>
</div>
