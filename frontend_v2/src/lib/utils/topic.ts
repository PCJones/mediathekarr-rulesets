/**
 * Topic utilities
 */

/**
 * Replace typographic dashes and quotes with their plain ASCII counterparts.
 * MediathekViewWeb topics use plain characters, e.g. "In aller Freundschaft - Die jungen Ärzte".
 */
export function normalizeTopic(topic: string): string {
	return topic
		.replace(/[‐-―−]/g, '-')
		.replace(/[„“”‟«»″]/g, '"')
		.replace(/[‚‘’‛‹›′]/g, "'")
		.trim();
}
