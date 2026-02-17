/**
 * Ruleset Store
 * Manages the current ruleset being edited in the wizard
 */

import { writable, derived } from 'svelte/store';
import type {
	Ruleset,
	Filter,
	RegexRule,
	MatchingStrategy,
	Media
} from '$types';
import { MATCHING_STRATEGIES } from '$types';

// Default empty ruleset
const defaultRuleset: Omit<Ruleset, 'id'> = {
	topic: '',
	tvdbId: undefined,
	priority: 0,
	filters: [],
	titleRegexRules: [],
	matchingStrategy: 'SeasonAndEpisodeNumber',
	seasonRegex: '',
	episodeRegex: ''
};

// Wizard step definition
export interface WizardStep {
	id: string;
	label: string;
	description: string;
	isValid: boolean;
	isOptional?: boolean;
}

// Create the main ruleset store
function createRulesetStore() {
	const { subscribe, set, update } = writable<Omit<Ruleset, 'id'>>(structuredClone(defaultRuleset));

	return {
		subscribe,
		set,
		update,

		// Reset to default
		reset: () => set(structuredClone(defaultRuleset)),

		// Load existing ruleset for editing
		loadRuleset: (ruleset: Ruleset) => {
			const { id, createdAt, updatedAt, createdBy, ...rest } = ruleset;
			set(rest);
		},

		// Update topic
		setTopic: (topic: string) => update(r => ({ ...r, topic })),

		// Update TVDB ID
		setTvdbId: (tvdbId: number | undefined) => update(r => ({ ...r, tvdbId })),

		// Update priority
		setPriority: (priority: number) => update(r => ({ ...r, priority })),

		// Filter management
		addFilter: (filter: Filter) =>
			update(r => ({ ...r, filters: [...r.filters, filter] })),

		updateFilter: (index: number, filter: Filter) =>
			update(r => ({
				...r,
				filters: r.filters.map((f, i) => (i === index ? filter : f))
			})),

		removeFilter: (index: number) =>
			update(r => ({
				...r,
				filters: r.filters.filter((_, i) => i !== index)
			})),

		// Title regex rules management
		addTitleRule: (rule: RegexRule) =>
			update(r => ({ ...r, titleRegexRules: [...r.titleRegexRules, rule] })),

		updateTitleRule: (index: number, rule: RegexRule) =>
			update(r => ({
				...r,
				titleRegexRules: r.titleRegexRules.map((tr, i) => (i === index ? rule : tr))
			})),

		removeTitleRule: (index: number) =>
			update(r => ({
				...r,
				titleRegexRules: r.titleRegexRules.filter((_, i) => i !== index)
			})),

		moveTitleRule: (from: number, to: number) =>
			update(r => {
				const rules = [...r.titleRegexRules];
				const [removed] = rules.splice(from, 1);
				rules.splice(to, 0, removed);
				return { ...r, titleRegexRules: rules };
			}),

		// Update matching strategy
		setMatchingStrategy: (strategy: MatchingStrategy) =>
			update(r => ({ ...r, matchingStrategy: strategy })),

		// Update season/episode regex
		setSeasonRegex: (regex: string) => update(r => ({ ...r, seasonRegex: regex })),
		setEpisodeRegex: (regex: string) => update(r => ({ ...r, episodeRegex: regex })),

		// Initialize with media data (for media-first approach)
		initWithMedia: (media: Media) => {
			update(r => ({
				...r,
				tvdbId: media.tvdbId ?? undefined,
				topic: media.name
			}));
		}
	};
}

// Export the store
export const rulesetStore = createRulesetStore();

// Wizard state store
interface WizardState {
	currentStep: number;
	isEditing: boolean;
	editingId?: number;
}

function createWizardStore() {
	const { subscribe, set, update } = writable<WizardState>({
		currentStep: 0,
		isEditing: false
	});

	return {
		subscribe,

		// Navigation
		nextStep: () => update(s => ({ ...s, currentStep: s.currentStep + 1 })),
		prevStep: () => update(s => ({ ...s, currentStep: Math.max(0, s.currentStep - 1) })),
		goToStep: (step: number) => update(s => ({ ...s, currentStep: step })),

		// Edit mode
		startEditing: (id: number) => set({ currentStep: 0, isEditing: true, editingId: id }),
		startCreating: () => set({ currentStep: 0, isEditing: false, editingId: undefined }),

		// Reset
		reset: () => set({ currentStep: 0, isEditing: false, editingId: undefined })
	};
}

export const wizardStore = createWizardStore();

// Derived store for wizard steps validation
// Note: "show" step removed - media is now selected before entering wizard
export const wizardSteps = derived(rulesetStore, ($ruleset): WizardStep[] => {
	const strategyInfo = MATCHING_STRATEGIES.find(s => s.value === $ruleset.matchingStrategy);

	return [
		{
			id: 'topic',
			label: 'Topics definieren',
			description: 'Mediathek-Topics für diese Show',
			isValid: $ruleset.topic.trim().length > 0
		},
		{
			id: 'filters',
			label: 'Filter hinzufügen',
			description: 'Ergebnisse eingrenzen (z.B. Mindestdauer)',
			isValid: true, // Filters are optional
			isOptional: true
		},
		{
			id: 'strategy',
			label: 'Matching-Strategie',
			description: 'Wie sollen Episoden zugeordnet werden?',
			isValid: !!$ruleset.matchingStrategy
		},
		{
			id: 'titleRules',
			label: 'Titel-Regeln',
			description: 'Titel für den Abgleich konstruieren',
			isValid: !strategyInfo?.requiresTitleRules || $ruleset.titleRegexRules.length > 0,
			isOptional: !strategyInfo?.requiresTitleRules
		},
		{
			id: 'seasonEpisode',
			label: 'Season/Episode',
			description: 'Staffel- und Episoden-Extraktion',
			isValid: (
				(!strategyInfo?.requiresSeasonRegex || !!$ruleset.seasonRegex) &&
				(!strategyInfo?.requiresEpisodeRegex || !!$ruleset.episodeRegex)
			),
			isOptional: !strategyInfo?.requiresSeasonRegex && !strategyInfo?.requiresEpisodeRegex
		},
		{
			id: 'test',
			label: 'Testen & Speichern',
			description: 'Live-Test gegen die API',
			isValid: true
		}
	];
});

// Derived store for overall validation
export const isRulesetValid = derived(wizardSteps, ($steps) =>
	$steps.every(step => step.isValid || step.isOptional)
);
