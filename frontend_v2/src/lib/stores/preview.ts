import { writable } from 'svelte/store';
import type { MediathekItem } from '$types';

/**
 * Shared store for MediathekViewWeb preview results across wizard steps.
 * This allows all steps to access the fetched results without re-fetching.
 */

export interface PreviewState {
	/** The fetched MediathekViewWeb items */
	items: MediathekItem[];
	/** Loading state */
	isLoading: boolean;
	/** Error message if any */
	error: string | null;
	/** Total number of items fetched before filtering */
	totalFetched: number;
	/** Number of items filtered out (e.g., Audiodeskription) */
	filteredCount: number;
	/** Whether there might be more results (hit API limit) */
	hasMoreResults: boolean;
}

const initialState: PreviewState = {
	items: [],
	isLoading: false,
	error: null,
	totalFetched: 0,
	filteredCount: 0,
	hasMoreResults: false
};

function createPreviewStore() {
	const { subscribe, set, update } = writable<PreviewState>(initialState);

	return {
		subscribe,

		/** Set loading state */
		setLoading: (isLoading: boolean) => {
			update(state => ({ ...state, isLoading, error: isLoading ? null : state.error }));
		},

		/** Set error state */
		setError: (error: string | null) => {
			update(state => ({ ...state, error, isLoading: false }));
		},

		/** Set preview results */
		setResults: (data: {
			items: MediathekItem[];
			totalFetched: number;
			filteredCount: number;
			hasMoreResults: boolean;
		}) => {
			set({
				items: data.items,
				totalFetched: data.totalFetched,
				filteredCount: data.filteredCount,
				hasMoreResults: data.hasMoreResults,
				isLoading: false,
				error: null
			});
		},

		/** Clear all results */
		clear: () => {
			set(initialState);
		},

		/** Reset store (alias for clear) */
		reset: () => {
			set(initialState);
		}
	};
}

export const previewStore = createPreviewStore();
