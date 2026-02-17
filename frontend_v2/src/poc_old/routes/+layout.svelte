<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isLoggedIn, logout } from '$api/auth';

	let { children } = $props();

	// Theme management
	let theme = $state<'light' | 'dark'>('light');
	let loggedIn = $state(false);

	onMount(() => {
		// Load theme from localStorage or system preference
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'dark' || savedTheme === 'light') {
			theme = savedTheme;
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			theme = 'dark';
		}
		document.documentElement.setAttribute('data-theme', theme);

		// Check login status
		loggedIn = isLoggedIn();
	});

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}

	function handleLogout() {
		logout();
		loggedIn = false;
		goto('/login');
	}
</script>

<div class="min-h-screen bg-base-100">
	<!-- Navbar -->
	<nav class="navbar bg-base-200 shadow-sm">
		<div class="flex-1">
			<a href="/" class="btn btn-ghost text-xl font-bold">MediathekArr Rulesets</a>
		</div>
		<div class="flex-none gap-2">
			<a href="/media" class="btn btn-ghost btn-sm">Media</a>
			<a href="/sandbox" class="btn btn-ghost btn-sm">Sandbox</a>

			{#if loggedIn}
				<button class="btn btn-ghost btn-sm" onclick={handleLogout}>Logout</button>
			{:else}
				<a href="/login" class="btn btn-ghost btn-sm">Login</a>
			{/if}

			<!-- Theme toggle -->
			<button class="btn btn-ghost btn-circle" onclick={toggleTheme} aria-label="Theme wechseln">
				{#if theme === 'light'}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
					</svg>
				{/if}
			</button>
		</div>
	</nav>

	<!-- Main content -->
	<main class="container mx-auto p-4 md:p-6">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="footer footer-center p-4 bg-base-200 text-base-content mt-auto">
		<div>
			<p>MediathekArr Rulesets - Phase 1 MVP</p>
		</div>
	</footer>
</div>
