<script lang="ts">
	import { goto } from '$app/navigation';
	import { login, isLoggedIn } from '$api/auth';
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let isLoading = $state(false);

	// Redirect if already logged in
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

<div class="min-h-[70vh] flex items-center justify-center">
	<div class="card w-full max-w-md bg-base-200 shadow-xl">
		<div class="card-body">
			<h1 class="card-title text-2xl justify-center mb-4">Login</h1>

			{#if error}
				<div class="alert alert-error mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{error}</span>
				</div>
			{/if}

			<form onsubmit={handleSubmit}>
				<div class="form-control mb-4">
					<label class="label" for="email">
						<span class="label-text">E-Mail</span>
					</label>
					<input
						id="email"
						type="email"
						class="input input-bordered"
						placeholder="E-Mail eingeben"
						bind:value={email}
						disabled={isLoading}
					/>
				</div>

				<div class="form-control mb-6">
					<label class="label" for="password">
						<span class="label-text">Passwort</span>
					</label>
					<input
						id="password"
						type="password"
						class="input input-bordered"
						placeholder="Passwort eingeben"
						bind:value={password}
						disabled={isLoading}
					/>
				</div>

				<button
					type="submit"
					class="btn btn-primary w-full"
					disabled={!email.trim() || !password.trim() || isLoading}
				>
					{#if isLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Anmelden
				</button>
			</form>
		</div>
	</div>
</div>
