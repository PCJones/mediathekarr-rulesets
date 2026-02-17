/**
 * Show Search API Service
 * Search for TV shows via UmlautAdaptarr API
 */

export interface SearchResult {
	status: string;
	germanTitle: string;
	originalTitle: string;
	tvdbId: number;
	aliases: string[];
	year?: number;
}

const SEARCH_API_URL = 'https://umlautadaptarr.pcjones.de/api/v1/tvshow_german.php';

/**
 * Search for a TV show by title
 */
export async function searchShow(title: string): Promise<SearchResult[]> {
	if (!title.trim()) return [];

	const response = await fetch(`${SEARCH_API_URL}?title=${encodeURIComponent(title)}`);

	if (!response.ok) {
		throw new Error(`Search failed: ${response.status}`);
	}

	const result = await response.json();

	if (result.status !== 'success') {
		return [];
	}

	// API returns single result, wrap in array for consistency
	return [result];
}
