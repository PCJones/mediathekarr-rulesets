<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { authStore, isAdmin, isAuthenticated } from '$stores/auth';
	import { themeStore } from '$stores/theme';
	import ThemePicker from '$components/ui/ThemePicker.svelte';

	let { children } = $props();

	let currentPath = $derived($page.url.pathname);

	interface NavLink {
		href: string;
		label: string;
		requiresAuth?: boolean;
	}

	const navLinks: NavLink[] = [
		{ href: '/media', label: 'Media' },
		{ href: '/sandbox', label: 'Sandbox' },
		{ href: '/suggestions', label: 'Vorschläge' }
	];

	onMount(() => {
		themeStore.init();
		authStore.init();

		const unsubSystemTheme = themeStore.listenForSystemChanges();
		return () => {
			if (typeof unsubSystemTheme === 'function') unsubSystemTheme();
		};
	});

	function handleLogout() {
		authStore.logout();
		goto('/');
	}

	function isActive(href: string): boolean {
		if (href === '/') return currentPath === '/';
		return currentPath.startsWith(href);
	}
</script>

<div class="min-h-screen bg-bg text-text">
	<!-- Header -->
	<header class="border-b border-border bg-surface">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
			<!-- Left: Logo + Nav -->
			<div class="flex items-center gap-6">
				<a href="/" class="text-lg font-bold text-text hover:text-accent transition-colors">
					MediathekArr
				</a>

				<nav class="hidden sm:flex items-center gap-1">
					{#each navLinks as link}
						<a
							href={link.href}
							class="relative px-3 py-1.5 text-sm font-medium transition-colors rounded-md"
							class:text-accent={isActive(link.href)}
							class:text-text-secondary={!isActive(link.href)}
							class:hover:text-text={!isActive(link.href)}
							class:hover:bg-surface-raised={!isActive(link.href)}
						>
							{link.label}
							{#if isActive(link.href)}
								<span class="absolute bottom-0 left-3 right-3 h-0.5 bg-accent rounded-full"></span>
							{/if}
						</a>
					{/each}
				</nav>
			</div>

			<!-- Right: Auth + Theme -->
			<div class="flex items-center gap-3">
				{#if $isAuthenticated}
					<span class="hidden sm:inline text-sm text-text-secondary">
						{$authStore.user?.displayName}
					</span>
					{#if $isAdmin}
						<span class="badge badge-accent badge-sm">Admin</span>
					{/if}
					<button
						class="btn btn-ghost btn-sm"
						onclick={handleLogout}
					>
						Logout
					</button>
				{:else}
					<a href="/login" class="btn btn-ghost btn-sm">Login</a>
				{/if}

				<ThemePicker />
			</div>
		</div>

		<!-- Mobile nav -->
		<nav class="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
			{#each navLinks as link}
				<a
					href={link.href}
					class="px-3 py-1 text-sm font-medium rounded-md whitespace-nowrap"
					class:text-accent={isActive(link.href)}
					class:bg-surface-raised={isActive(link.href)}
					class:text-text-secondary={!isActive(link.href)}
				>
					{link.label}
				</a>
			{/each}
		</nav>
	</header>

	<!-- Main content -->
	<main class="mx-auto max-w-7xl px-4 py-6">
		{@render children()}
	</main>
</div>
