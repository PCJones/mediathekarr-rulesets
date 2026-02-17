<script lang="ts">
	import { themeStore, currentPalette, isDark } from '$stores/theme';
	import type { Palette } from '$stores/theme';

	const palettes: { id: Palette; label: string; color: string }[] = [
		{ id: 'signal', label: 'Signal', color: '#2563eb' },
		{ id: 'indigo', label: 'Indigo', color: '#6366f1' },
		{ id: 'emerald', label: 'Emerald', color: '#059669' }
	];
</script>

<div class="flex items-center gap-2">
	<!-- Palette dots -->
	<div class="flex items-center gap-1.5">
		{#each palettes as palette}
			<button
				class="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
				style="background-color: {palette.color}; border-color: {$currentPalette === palette.id ? 'var(--color-text)' : 'transparent'}"
				onclick={() => themeStore.setPalette(palette.id)}
				aria-label="Palette: {palette.label}"
				title={palette.label}
			></button>
		{/each}
	</div>

	<!-- Divider -->
	<div class="h-5 w-px bg-border-strong"></div>

	<!-- Sun/Moon toggle -->
	<button
		class="rounded-full p-1.5 text-text-secondary hover:bg-surface-raised hover:text-text"
		onclick={() => themeStore.toggleMode()}
		aria-label={$isDark ? 'Heller Modus' : 'Dunkler Modus'}
	>
		{#if $isDark}
			<!-- Sun icon -->
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
			</svg>
		{:else}
			<!-- Moon icon -->
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
			</svg>
		{/if}
	</button>
</div>
