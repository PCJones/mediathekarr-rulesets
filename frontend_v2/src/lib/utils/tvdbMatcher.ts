/**
 * TVDB Episode Matching Utility
 * Provides unified matching logic based on strategy
 */

import type {
	MediathekItem,
	TvdbEpisode,
	MatchingStrategy,
	RegexRule
} from '$types';
import {
	buildTitleFromRules,
	extractSeasonEpisode,
	isStaticSeasonEpisode,
	extractStaticValue,
	testRegex
} from './regex';
import {
	findEpisodeBySeasonEpisode,
	findEpisodeByAbsolute,
	findEpisodeByTitle,
	findEpisodeByAirdate
} from '$api/tvdb';

export interface TvdbMatchResult {
	matched: boolean;
	episode: TvdbEpisode | null;
	matchDetails: {
		strategy: MatchingStrategy;
		constructedTitle: string | null;
		season: number | null;
		episode: number | null;
		searchedValue?: string;
	};
	error?: string;
}

/**
 * Match a MediathekItem against TVDB episodes using the specified strategy
 */
export function matchEpisodeByStrategy(
	item: MediathekItem,
	episodes: TvdbEpisode[],
	strategy: MatchingStrategy,
	titleRules: RegexRule[],
	seasonRegex?: string,
	episodeRegex?: string
): TvdbMatchResult {
	// Build constructed title if we have rules
	let constructedTitle: string | null = null;
	if (titleRules.length > 0) {
		const { finalTitle } = buildTitleFromRules(item, titleRules);
		constructedTitle = finalTitle;
	} else {
		// No title rules - use original title
		constructedTitle = item.title;
	}

	// Extract season/episode if needed
	let seasonValue: number | null = null;
	let episodeValue: number | null = null;

	if (seasonRegex) {
		if (isStaticSeasonEpisode(seasonRegex)) {
			seasonValue = extractStaticValue(seasonRegex);
		} else if (constructedTitle) {
			const { firstGroup } = testRegex(seasonRegex, constructedTitle);
			seasonValue = firstGroup ? parseInt(firstGroup, 10) : null;
		}
	}

	if (episodeRegex) {
		if (isStaticSeasonEpisode(episodeRegex)) {
			episodeValue = extractStaticValue(episodeRegex);
		} else if (constructedTitle) {
			const { firstGroup } = testRegex(episodeRegex, constructedTitle);
			episodeValue = firstGroup ? parseInt(firstGroup, 10) : null;
		}
	}

	const baseResult: TvdbMatchResult = {
		matched: false,
		episode: null,
		matchDetails: {
			strategy,
			constructedTitle,
			season: seasonValue,
			episode: episodeValue
		}
	};

	// If no episodes to match against, return early
	if (episodes.length === 0) {
		return {
			...baseResult,
			error: 'Keine TVDB-Episoden verfügbar'
		};
	}

	// Apply matching based on strategy
	switch (strategy) {
		case 'SeasonAndEpisodeNumber': {
			if (seasonValue === null || episodeValue === null) {
				return {
					...baseResult,
					error: seasonValue === null
						? 'Season konnte nicht extrahiert werden'
						: 'Episode konnte nicht extrahiert werden'
				};
			}
			const episode = findEpisodeBySeasonEpisode(episodes, seasonValue, episodeValue);
			return {
				...baseResult,
				matched: episode !== null,
				episode,
				matchDetails: {
					...baseResult.matchDetails,
					searchedValue: `S${seasonValue}E${episodeValue}`
				}
			};
		}

		case 'AbsoluteEpisodeNumber':
		case 'ByAbsoluteEpisodeNumber': {
			if (episodeValue === null) {
				return {
					...baseResult,
					error: 'Episode konnte nicht extrahiert werden'
				};
			}
			const episode = findEpisodeByAbsolute(episodes, episodeValue);
			return {
				...baseResult,
				matched: episode !== null,
				episode,
				matchDetails: {
					...baseResult.matchDetails,
					searchedValue: `Episode ${episodeValue}`
				}
			};
		}

		case 'ItemTitleIncludes': {
			if (!constructedTitle) {
				return {
					...baseResult,
					error: 'Titel konnte nicht konstruiert werden'
				};
			}
			const episode = findEpisodeByTitle(episodes, constructedTitle, false);
			return {
				...baseResult,
				matched: episode !== null,
				episode,
				matchDetails: {
					...baseResult.matchDetails,
					searchedValue: constructedTitle
				}
			};
		}

		case 'ItemTitleExact': {
			if (!constructedTitle) {
				return {
					...baseResult,
					error: 'Titel konnte nicht konstruiert werden'
				};
			}
			const episode = findEpisodeByTitle(episodes, constructedTitle, true);
			return {
				...baseResult,
				matched: episode !== null,
				episode,
				matchDetails: {
					...baseResult.matchDetails,
					searchedValue: constructedTitle
				}
			};
		}

		case 'ItemTitleEqualsAirdate': {
			if (!constructedTitle) {
				return {
					...baseResult,
					error: 'Titel konnte nicht konstruiert werden'
				};
			}
			const episode = findEpisodeByAirdate(episodes, constructedTitle);
			return {
				...baseResult,
				matched: episode !== null,
				episode,
				matchDetails: {
					...baseResult.matchDetails,
					searchedValue: constructedTitle
				}
			};
		}

		default:
			return {
				...baseResult,
				error: `Unbekannte Strategie: ${strategy}`
			};
	}
}
