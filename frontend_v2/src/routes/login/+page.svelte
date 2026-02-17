<script lang="ts">
	import { goto } from '$app/navigation';
	import { login, isLoggedIn } from '$api/auth';
	import { authStore } from '$stores/auth';
	import { onMount } from 'svelte';
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';
	import Input from '$components/ui/Input.svelte';
	import Alert from '$components/ui/Alert.svelte';
	import Spinner from '$components/ui/Spinner.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let isLoading = $state(false);

	onMount(() => {
		if (isLoggedIn()) {
			goto('/media');
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!email.trim() || !password.trim()) return;

		isLoading = true;
		error = null;

		try {
			await login(email, password);
			authStore.init();
			goto('/media');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Login fehlgeschlagen';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Login - MediathekArr</title>
</svelte:head>

<div class="min-h-[60vh] flex items-center justify-center">
	<div class="w-full max-w-md">
		<Card padding="lg">
			<h1 class="text-2xl font-bold text-center mb-6">Login</h1>

			{#if error}
				<div class="mb-4">
					<Alert variant="error">{error}</Alert>
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4">
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
					placeholder="Passwort eingeben"
					bind:value={password}
					disabled={isLoading}
				/>

				<Button
					type="submit"
					variant="primary"
					disabled={!email.trim() || !password.trim()}
					loading={isLoading}
				>
					Anmelden
				</Button>
			</form>
		</Card>
	</div>
</div>
