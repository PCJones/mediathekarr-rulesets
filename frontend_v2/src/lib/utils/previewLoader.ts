import { previewStore } from '$stores/preview';
import { queryByTopic } from '$api/mediathekview';
import type { MediathekItem } from '$types';

const MAX_PER_TOPIC = 1000;
const DEBOUNCE_MS = 500;

function isAccessibilityVariant(item: MediathekItem): boolean {
	const title = item.title.toLowerCase();
	return title.includes('audiodeskription') || title.includes('gebärdensprache');
}

/** Debounced loader that fills the shared preview store for a (pipe-separated) topic string. */
export function createPreviewLoader() {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let requested: string | undefined;

	function load(topic: string) {
		if (topic === requested) return;
		requested = topic;
		clearTimeout(timeout);

		if (!topic) {
			previewStore.clear();
			return;
		}

		timeout = setTimeout(async () => {
			previewStore.setLoading(true);
			try {
				const results = await queryByTopic(topic, { maxPerTopic: MAX_PER_TOPIC });
				if (topic !== requested) return;
				const topicCount = topic.split('|').filter((t) => t.trim()).length;
				const items = results.filter((item) => !isAccessibilityVariant(item));
				previewStore.setResults({
					items,
					totalFetched: results.length,
					filteredCount: results.length - items.length,
					hasMoreResults: results.length >= topicCount * MAX_PER_TOPIC
				});
			} catch (e) {
				if (topic !== requested) return;
				previewStore.setError(e instanceof Error ? e.message : 'Fehler beim Laden der Vorschau');
			}
		}, DEBOUNCE_MS);
	}

	return {
		load,
		destroy: () => clearTimeout(timeout)
	};
}
