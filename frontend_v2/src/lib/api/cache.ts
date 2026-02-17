/**
 * Client-side caching utilities
 * Uses sessionStorage for API responses (cleared on tab close)
 * Uses localStorage for persistent settings
 */

const CACHE_PREFIX = 'mkarr_';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

/**
 * Generate a cache key from query parameters
 */
export function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
	const sortedParams = Object.keys(params)
		.sort()
		.map(key => `${key}=${JSON.stringify(params[key])}`)
		.join('&');
	// Use full hash to avoid collisions - the old .slice(0, 50) caused different queries to share cache entries
	return `${CACHE_PREFIX}${prefix}_${btoa(sortedParams)}`;
}

/**
 * Get cached data from sessionStorage
 */
export function getFromCache<T>(key: string): T | null {
	try {
		const stored = sessionStorage.getItem(key);
		if (!stored) return null;

		const entry: CacheEntry<T> = JSON.parse(stored);
		const now = Date.now();

		// Check if expired
		if (now - entry.timestamp > entry.ttl) {
			sessionStorage.removeItem(key);
			return null;
		}

		return entry.data;
	} catch {
		return null;
	}
}

/**
 * Store data in sessionStorage cache
 */
export function setInCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
	try {
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl: ttlMs
		};
		sessionStorage.setItem(key, JSON.stringify(entry));
	} catch (e) {
		// Storage might be full, clear old entries
		clearExpiredCache();
		try {
			const entry: CacheEntry<T> = {
				data,
				timestamp: Date.now(),
				ttl: ttlMs
			};
			sessionStorage.setItem(key, JSON.stringify(entry));
		} catch {
			console.warn('Failed to cache data:', e);
		}
	}
}

/**
 * Remove specific cache entry
 */
export function removeFromCache(key: string): void {
	sessionStorage.removeItem(key);
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(): void {
	const now = Date.now();
	const keysToRemove: string[] = [];

	for (let i = 0; i < sessionStorage.length; i++) {
		const key = sessionStorage.key(i);
		if (key?.startsWith(CACHE_PREFIX)) {
			try {
				const stored = sessionStorage.getItem(key);
				if (stored) {
					const entry: CacheEntry<unknown> = JSON.parse(stored);
					if (now - entry.timestamp > entry.ttl) {
						keysToRemove.push(key);
					}
				}
			} catch {
				keysToRemove.push(key!);
			}
		}
	}

	keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
	const keysToRemove: string[] = [];

	for (let i = 0; i < sessionStorage.length; i++) {
		const key = sessionStorage.key(i);
		if (key?.startsWith(CACHE_PREFIX)) {
			keysToRemove.push(key);
		}
	}

	keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { entries: number; sizeBytes: number } {
	let entries = 0;
	let sizeBytes = 0;

	for (let i = 0; i < sessionStorage.length; i++) {
		const key = sessionStorage.key(i);
		if (key?.startsWith(CACHE_PREFIX)) {
			entries++;
			const value = sessionStorage.getItem(key);
			if (value) {
				sizeBytes += key.length + value.length;
			}
		}
	}

	return { entries, sizeBytes };
}

// Persistent storage helpers (localStorage)

/**
 * Save a setting to localStorage
 */
export function saveSetting<T>(key: string, value: T): void {
	try {
		localStorage.setItem(`${CACHE_PREFIX}setting_${key}`, JSON.stringify(value));
	} catch (e) {
		console.warn('Failed to save setting:', e);
	}
}

/**
 * Load a setting from localStorage
 */
export function loadSetting<T>(key: string, defaultValue: T): T {
	try {
		const stored = localStorage.getItem(`${CACHE_PREFIX}setting_${key}`);
		if (stored) {
			return JSON.parse(stored) as T;
		}
	} catch {
		// Ignore parse errors
	}
	return defaultValue;
}
