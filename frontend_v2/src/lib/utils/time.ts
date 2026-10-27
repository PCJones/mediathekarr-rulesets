/**
 * Timestamp helpers for API values.
 * The API returns SQLite UTC strings ("2026-08-18 15:15:53") without a zone marker.
 */

export function parseApiDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const normalised = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
		? `${value.replace(' ', 'T')}Z`
		: value;
	const date = new Date(normalised);
	return Number.isNaN(date.getTime()) ? null : date;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(value: string | Date | null | undefined): string {
	const date = value instanceof Date ? value : parseApiDate(value);
	if (!date) return '–';

	const diff = Date.now() - date.getTime();
	if (diff < MINUTE) return 'gerade eben';
	if (diff < HOUR) {
		const minutes = Math.floor(diff / MINUTE);
		return `vor ${minutes} Min.`;
	}
	if (diff < DAY) {
		const hours = Math.floor(diff / HOUR);
		return `vor ${hours} Std`;
	}
	const days = Math.floor(diff / DAY);
	if (days < 31) return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
	const months = Math.floor(days / 30);
	if (months < 12) return months === 1 ? 'vor 1 Monat' : `vor ${months} Monaten`;
	const years = Math.floor(days / 365);
	return years === 1 ? 'vor 1 Jahr' : `vor ${years} Jahren`;
}

/** Absolute date + time, e.g. "18.08.2026, 15:15". */
export function formatDate(value: string | Date | null | undefined): string {
	const date = value instanceof Date ? value : parseApiDate(value);
	if (!date) return '–';
	return date.toLocaleString('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/** Absolute date only, e.g. "18.08.2026". */
export function formatDay(value: string | Date | null | undefined): string {
	const date = value instanceof Date ? value : parseApiDate(value);
	if (!date) return '–';
	return date.toLocaleDateString('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
}
