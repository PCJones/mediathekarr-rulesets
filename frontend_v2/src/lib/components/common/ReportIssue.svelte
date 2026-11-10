<script lang="ts">
	import { page } from '$app/stores';
	import Modal from '$components/ui/Modal.svelte';
	import BugIcon from './BugIcon.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const DISCORD_URL = 'https://discord.gg/src6zcH4rr';
	const GITHUB_ISSUES_URL = 'https://github.com/PCJones/mediathekarr-rulesets/issues/new';

	let githubUrl = $derived(
		`${GITHUB_ISSUES_URL}?body=${encodeURIComponent(
			`**Seite:** ${$page.url.href}\n\n**Was ist passiert?**\n\n\n**Was hast du erwartet?**\n`
		)}`
	);
</script>

<button type="button" class="report-tab" onclick={() => (open = true)}>
	<BugIcon />
	<span class="report-tab-label">Fehler melden</span>
</button>

<Modal bind:open title="Fehler melden">
	<div class="space-y-4 sm:w-[26rem]">
		<p class="text-sm text-text-secondary">
			Beschreib kurz, auf welcher Seite du warst, was du erwartet hast und was stattdessen passiert ist.
		</p>

		<div class="space-y-2">
			<a href={DISCORD_URL} target="_blank" rel="noopener" class="report-option">
				<span class="report-option-icon">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.291.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
					</svg>
				</span>
				<span class="min-w-0 flex-1">
					<span class="block text-sm font-medium text-text">Discord</span>
					<span class="block text-xs text-text-tertiary">#mediathekarr auf dem UsenetDE-Server</span>
				</span>
			</a>

			<a href={githubUrl} target="_blank" rel="noopener" class="report-option">
				<span class="report-option-icon">
					<svg class="h-5 w-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
					</svg>
				</span>
				<span class="min-w-0 flex-1">
					<span class="block text-sm font-medium text-text">GitHub Issue</span>
					<span class="block text-xs text-text-tertiary">Mit Link zur aktuellen Seite vorausgefüllt</span>
				</span>
			</a>
		</div>
	</div>
</Modal>

<style>
	.report-tab {
		display: none;
		position: fixed;
		top: 50%;
		right: 0;
		z-index: 40;
		transform: translateY(-50%);
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 0.375rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text);
		background-color: color-mix(in srgb, var(--color-warning) 15%, var(--color-surface));
		border: 1px solid color-mix(in srgb, var(--color-warning) 40%, transparent);
		border-right: none;
		border-radius: 0.375rem 0 0 0.375rem;
		transition: background-color 150ms ease, color 150ms ease;
	}

	.report-tab:hover {
		background-color: color-mix(in srgb, var(--color-warning) 25%, var(--color-surface));
	}

	.report-tab :global(svg) {
		color: var(--color-warning);
	}

	.report-tab-label {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
	}

	@media (min-width: 1470px) {
		.report-tab {
			display: flex;
		}
	}

	@media (min-width: 1800px) {
		.report-tab {
			gap: 0.625rem;
			padding: 1.125rem 0.625rem;
			font-size: 0.875rem;
		}

		.report-tab :global(svg) {
			width: 1.25rem;
			height: 1.25rem;
		}
	}

	.report-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		transition: background-color 150ms ease, border-color 150ms ease;
	}

	.report-option:hover {
		background-color: var(--color-surface-raised);
		border-color: var(--color-border-strong);
	}

	.report-option-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		border-radius: 0.375rem;
		background-color: var(--color-surface-raised);
		color: var(--color-text-secondary);
	}
</style>
