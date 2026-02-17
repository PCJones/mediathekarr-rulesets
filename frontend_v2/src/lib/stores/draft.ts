/**
 * Draft Store
 * Manages in-progress (not yet added) filters and rules for real-time preview
 */

import { writable } from 'svelte/store';
import type { Filter, RegexRule } from '$types';

export interface DraftState {
	/** Draft filter being typed in FilterEditor */
	filter: Filter | null;
	/** Draft title rule being typed in TitleRulesEditor */
	titleRule: RegexRule | null;
	/** Draft season regex being typed in SeasonEpisodeEditor */
	seasonRegex: string | null;
	/** Draft episode regex being typed in SeasonEpisodeEditor */
	episodeRegex: string | null;
}

const initialState: DraftState = {
	filter: null,
	titleRule: null,
	seasonRegex: null,
	episodeRegex: null
};

function createDraftStore() {
	const { subscribe, set, update } = writable<DraftState>(initialState);

	return {
		subscribe,

		/** Set draft filter (from FilterEditor form) */
		setDraftFilter: (filter: Filter | null) => {
			update(state => ({ ...state, filter }));
		},

		/** Set draft title rule (from TitleRulesEditor form) */
		setDraftTitleRule: (titleRule: RegexRule | null) => {
			update(state => ({ ...state, titleRule }));
		},

		/** Set draft season regex (from SeasonEpisodeEditor) */
		setDraftSeasonRegex: (seasonRegex: string | null) => {
			update(state => ({ ...state, seasonRegex }));
		},

		/** Set draft episode regex (from SeasonEpisodeEditor) */
		setDraftEpisodeRegex: (episodeRegex: string | null) => {
			update(state => ({ ...state, episodeRegex }));
		},

		/** Clear all draft state */
		clearAll: () => {
			set(initialState);
		},

		/** Clear only the filter draft */
		clearFilter: () => {
			update(state => ({ ...state, filter: null }));
		},

		/** Clear only the title rule draft */
		clearTitleRule: () => {
			update(state => ({ ...state, titleRule: null }));
		}
	};
}

export const draftStore = createDraftStore();
