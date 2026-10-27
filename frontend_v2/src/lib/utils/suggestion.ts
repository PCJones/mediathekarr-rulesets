import type { MediaType } from '$types/media';
import type { StaleEntry, SuggestionStatus } from '$types/suggestion';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'error' | 'info';

const STATUS_LABELS: Record<SuggestionStatus, string> = {
	open: 'Offen',
	accepted: 'Angenommen',
	rejected: 'Abgelehnt',
	withdrawn: 'Zurückgezogen'
};

const STATUS_VARIANTS: Record<SuggestionStatus, BadgeVariant> = {
	open: 'info',
	accepted: 'success',
	rejected: 'error',
	withdrawn: 'default'
};

export function statusLabel(status: SuggestionStatus): string {
	return STATUS_LABELS[status];
}

export function statusVariant(status: SuggestionStatus): BadgeVariant {
	return STATUS_VARIANTS[status];
}

export function mediaTypeLabel(type: MediaType): string {
	return type === 'show' ? 'Serie' : 'Film';
}

export function newMediaLabel(type: MediaType): string {
	return type === 'show' ? 'Neue Serie' : 'Neuer Film';
}

export function staleLabel(entry: StaleEntry): string {
	switch (entry.reason) {
		case 'ruleset_changed':
			return `Änderung ${entry.key}: Das Live-Ruleset wurde geändert`;
		case 'ruleset_missing':
			return `Änderung ${entry.key}: Das Ruleset existiert nicht mehr`;
		case 'media_missing':
			return 'Die Serie existiert nicht mehr';
		case 'media_exists':
			return 'Die vorgeschlagene Serie existiert bereits';
	}
}
