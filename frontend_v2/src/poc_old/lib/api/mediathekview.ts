/**
 * MediathekViewWeb API Service
 * Direct browser calls to https://mediathekviewweb.de/api/query
 */

import type {
	MediathekQueryRequest,
	MediathekApiResponse,
	MediathekItem,
	MediathekQueryField
} from '$types';
import { generateCacheKey, getFromCache, setInCache } from './cache';

const API_URL = 'https://mediathekviewweb.de/api/query';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface QueryOptions {
	/** Topic(s) to search for (supports pipe-separated) */
	topic?: string;
	/** Title to search for */
	title?: string;
	/** Fields to search in */
	fields?: MediathekQueryField[];
	/** General search query */
	query?: string;
	/** Sort field */
	sortBy?: 'filmlisteTimestamp' | 'timestamp' | 'duration' | 'channel';
	/** Sort order */
	sortOrder?: 'asc' | 'desc';
	/** Include future items */
	future?: boolean;
	/** Pagination offset */
	offset?: number;
	/** Number of results (max 500) */
	size?: number;
	/** Skip cache and fetch fresh */
	skipCache?: boolean;
}

/**
 * Query the MediathekViewWeb API
 */
export async function queryMediathek(options: QueryOptions): Promise<MediathekItem[]> {
	const {
		topic,
		title,
		fields = ['topic', 'title'],
		query,
		sortBy = 'filmlisteTimestamp',
		sortOrder = 'desc',
		future = true,
		offset = 0,
		size = 100,
		skipCache = false
	} = options;

	// Build the query
	const searchQuery = query || topic || title || '';
	if (!searchQuery) {
		return [];
	}

	const requestBody: MediathekQueryRequest = {
		queries: [
			{
				fields,
				query: searchQuery
			}
		],
		sortBy,
		sortOrder,
		future,
		offset,
		size: Math.min(size, 500) // API limit
	};

	// Check cache first
	const cacheKey = generateCacheKey('mediathek', requestBody as unknown as Record<string, unknown>);
	if (!skipCache) {
		const cached = getFromCache<MediathekItem[]>(cacheKey);
		if (cached) {
			return cached;
		}
	}

	// Make API request
	const response = await fetch(API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'text/plain' // MediathekViewWeb expects text/plain
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		throw new Error(`MediathekViewWeb API error: ${response.status} ${response.statusText}`);
	}

	const data: MediathekApiResponse = await response.json();

	if (data.err) {
		throw new Error(`MediathekViewWeb API error: ${data.err}`);
	}

	const results = data.result?.results || [];

	// Cache the results
	setInCache(cacheKey, results, CACHE_TTL_MS);

	return results;
}

/**
 * Query by topic name (supports pipe-separated topics)
 * @param maxPerTopic - Maximum results per topic (default 3000)
 */
export async function queryByTopic(
	topic: string,
	options: Omit<QueryOptions, 'topic' | 'fields'> & { maxPerTopic?: number } = {}
): Promise<MediathekItem[]> {
	const { maxPerTopic = 3000, ...queryOptions } = options;

	// Split pipe-separated topics and query each
	const topics = topic.split('|').map(t => t.trim()).filter(Boolean);

	if (topics.length === 0) {
		return [];
	}

	// Helper to fetch up to maxPerTopic results for a single topic
	async function fetchForTopic(t: string): Promise<MediathekItem[]> {
		const results: MediathekItem[] = [];
		let offset = 0;
		const batchSize = 500; // API limit per request

		while (results.length < maxPerTopic) {
			const batch = await queryMediathek({
				...queryOptions,
				query: t,
				fields: ['topic'],
				size: Math.min(batchSize, maxPerTopic - results.length),
				offset
			});

			results.push(...batch);

			// Stop if we got fewer than requested (no more results)
			if (batch.length < batchSize) {
				break;
			}

			offset += batchSize;
		}

		return results;
	}

	// For single topic, query directly
	if (topics.length === 1) {
		return fetchForTopic(topics[0]);
	}

	// For multiple topics, query each and combine results
	const allResults = await Promise.all(topics.map(fetchForTopic));

	// Combine and deduplicate by id
	const seenIds = new Set<string>();
	const combined: MediathekItem[] = [];

	for (const results of allResults) {
		for (const item of results) {
			if (!seenIds.has(item.id)) {
				seenIds.add(item.id);
				combined.push(item);
			}
		}
	}

	// Sort by timestamp descending
	combined.sort((a, b) => b.timestamp - a.timestamp);

	return combined;
}

/**
 * Get total count for a query (for pagination info)
 */
export async function getQueryCount(options: QueryOptions): Promise<number> {
	const response = await fetch(API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'text/plain'
		},
		body: JSON.stringify({
			queries: [
				{
					fields: options.fields || ['topic', 'title'],
					query: options.query || options.topic || ''
				}
			],
			sortBy: 'filmlisteTimestamp',
			sortOrder: 'desc',
			future: options.future ?? true,
			offset: 0,
			size: 1 // Minimal size just to get count
		})
	});

	if (!response.ok) {
		throw new Error(`MediathekViewWeb API error: ${response.status}`);
	}

	const data: MediathekApiResponse = await response.json();
	return data.result?.queryInfo?.totalResults || 0;
}

/**
 * Format duration from seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return `${hours}h ${minutes}min`;
	}
	return `${minutes} min`;
}

/**
 * Format file size from bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format timestamp to German locale date string
 */
export function formatTimestamp(timestamp: number): string {
	return new Date(timestamp * 1000).toLocaleDateString('de-DE', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}
