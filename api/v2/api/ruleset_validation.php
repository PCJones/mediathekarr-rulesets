<?php

require_once __DIR__ . '/../config.php';

const MATCHING_STRATEGIES = [
    'SeasonAndEpisodeNumber', 'AbsoluteEpisodeNumber',
    'ItemTitleExact', 'ItemTitleIncludes', 'ItemTitleEqualsAirdate'
];
const FILTER_ATTRIBUTES = ['duration', 'channel', 'title', 'topic', 'description'];
const FILTER_TYPES = ['GreaterThan', 'LessThan', 'Equals', 'Contains', 'Regex'];
const RULE_FIELDS = ['title', 'topic', 'description', 'channel'];
const RULESET_BODY_FIELDS = ['topic', 'matchingStrategy', 'filters', 'titleRegexRules', 'seasonRegex', 'episodeRegex'];

function validateRegex(string $pattern, string $fieldName, string $prefix = ''): void {
    if (@preg_match("\x01" . $pattern . "\x01", '') === false) {
        $detail = preg_replace('/^preg_match\(\): (Compilation failed: )?/', '', error_get_last()['message'] ?? 'invalid pattern');
        errorResponse("{$prefix}Invalid regex in '$fieldName': $detail", 400);
    }
}

function validateRulesetInput(PDO $db, array $input, string $prefix = ''): void {
    if (array_key_exists('topic', $input) && (!is_string($input['topic']) || trim($input['topic']) === '')) {
        errorResponse("{$prefix}topic must be a non-empty string", 400);
    }
    if (array_key_exists('matchingStrategy', $input) && !in_array($input['matchingStrategy'], MATCHING_STRATEGIES, true)) {
        errorResponse("{$prefix}Invalid matchingStrategy", 400);
    }
    if (array_key_exists('priority', $input) && !is_int($input['priority'])) {
        errorResponse("{$prefix}priority must be an integer", 400);
    }
    if (array_key_exists('mediaId', $input) && $input['mediaId'] !== null) {
        if (!is_int($input['mediaId'])) {
            errorResponse("{$prefix}mediaId must be an integer", 400);
        }
        $stmt = $db->prepare('SELECT id FROM media WHERE id = ?');
        $stmt->execute([$input['mediaId']]);
        if (!$stmt->fetch()) {
            errorResponse("{$prefix}Media not found", 404);
        }
    }
    foreach (['seasonRegex', 'episodeRegex'] as $field) {
        $value = $input[$field] ?? null;
        if ($value === null) {
            continue;
        }
        if (!is_string($value)) {
            errorResponse("{$prefix}$field must be a string", 400);
        }
        if ($value !== '') {
            validateRegex($value, $field, $prefix);
        }
    }
    if (array_key_exists('filters', $input)) {
        if (!is_array($input['filters']) || !array_is_list($input['filters'])) {
            errorResponse("{$prefix}filters must be an array", 400);
        }
        foreach ($input['filters'] as $i => $f) {
            if (!is_array($f) || !in_array($f['attribute'] ?? null, FILTER_ATTRIBUTES, true)
                || !in_array($f['type'] ?? null, FILTER_TYPES, true) || !is_string($f['value'] ?? null)) {
                errorResponse("{$prefix}Invalid filter at index $i", 400);
            }
            if ($f['type'] === 'Regex') {
                validateRegex($f['value'], "filters[$i].value", $prefix);
            }
            // Only plain decimals, so the editor preview (JS) and MediathekArr (.NET) parse them identically
            if (($f['attribute'] === 'duration' || in_array($f['type'], ['GreaterThan', 'LessThan'], true))
                && !preg_match('/^\d+(\.\d+)?$/D', $f['value'])) {
                errorResponse("{$prefix}Filter at index $i needs a numeric value", 400);
            }
        }
    }
    if (array_key_exists('titleRegexRules', $input)) {
        if (!is_array($input['titleRegexRules']) || !array_is_list($input['titleRegexRules'])) {
            errorResponse("{$prefix}titleRegexRules must be an array", 400);
        }
        foreach ($input['titleRegexRules'] as $i => $r) {
            if (!is_array($r)) {
                errorResponse("{$prefix}Invalid title rule at index $i", 400);
            }
            if (($r['type'] ?? null) === 'static') {
                if (!is_string($r['value'] ?? null)) {
                    errorResponse("{$prefix}Title rule $i: static rule needs a string value", 400);
                }
            } elseif (($r['type'] ?? null) === 'regex') {
                if (!in_array($r['field'] ?? null, RULE_FIELDS, true) || !is_string($r['pattern'] ?? null)) {
                    errorResponse("{$prefix}Title rule $i: regex rule needs field and pattern", 400);
                }
                validateRegex($r['pattern'], "titleRegexRules[$i].pattern", $prefix);
            } else {
                errorResponse("{$prefix}Title rule $i: type must be 'static' or 'regex'", 400);
            }
        }
    }
}

function rulesetBody(array $input): array {
    $body = [];
    foreach (RULESET_BODY_FIELDS as $field) {
        $value = $input[$field] ?? null;
        $body[$field] = match ($field) {
            'topic', 'matchingStrategy' => is_string($value) ? $value : '',
            'filters', 'titleRegexRules' => is_array($value) ? array_values($value) : [],
            default => is_string($value) && $value !== '' ? $value : null,
        };
    }
    return $body;
}

function canonicalSort(mixed $value): mixed {
    if (!is_array($value)) {
        return $value;
    }
    $value = array_map('canonicalSort', $value);
    if (!array_is_list($value)) {
        ksort($value);
    }
    return $value;
}

function formatRuleset(array $ruleset): array {
    return [
        'id' => (int)$ruleset['id'],
        'mediaId' => $ruleset['mediaId'] ? (int)$ruleset['mediaId'] : null,
        'topic' => $ruleset['topic'],
        'priority' => (int)$ruleset['priority'],
        'filters' => json_decode($ruleset['filters'] ?? '[]', true),
        'titleRegexRules' => json_decode($ruleset['titleRegexRules'] ?? '[]', true),
        'episodeRegex' => $ruleset['episodeRegex'],
        'seasonRegex' => $ruleset['seasonRegex'],
        'matchingStrategy' => $ruleset['matchingStrategy'],
        'media' => isset($ruleset['media_name']) ? [
            'name' => $ruleset['media_name'],
            'tvdbId' => $ruleset['media_tvdbId'] ? (int)$ruleset['media_tvdbId'] : null
        ] : null
    ];
}

function rulesetHash(array $input): string {
    $canonical = canonicalSort(rulesetBody($input));
    return 'sha256:' . hash('sha256', json_encode($canonical, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function validateMediaInput(array $media, string $prefix = ''): void {
    $type = $media['type'] ?? null;
    if (!in_array($type, ['movie', 'show'], true)) {
        errorResponse($prefix . 'type must be "movie" or "show"', 400);
    }
    foreach (['tvdbId', 'tmdbId'] as $field) {
        if (($media[$field] ?? null) !== null && !is_int($media[$field])) {
            errorResponse($prefix . "$field must be an integer", 400);
        }
    }
    if (($media['imdbId'] ?? null) !== null && !is_string($media['imdbId'])) {
        errorResponse($prefix . 'imdbId must be a string', 400);
    }
    if ($type === 'show' && primaryMediaId($media) === null) {
        errorResponse($prefix . 'Serien brauchen eine TVDB-ID', 400);
    }
    if ($type === 'movie') {
        $imdbId = $media['imdbId'] ?? null;
        if (primaryMediaId($media) === null || !is_string($imdbId) || trim($imdbId) === '') {
            errorResponse($prefix . 'Filme brauchen eine TMDB-ID und eine IMDB-ID', 400);
        }
    }
}

function primaryMediaIdField(string $type): string {
    return $type === 'show' ? 'tvdbId' : 'tmdbId';
}

function primaryMediaId(array $media): ?int {
    $value = $media[primaryMediaIdField($media['type'] ?? '')] ?? null;
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    return $id === false ? null : $id;
}

function isSameMedia(array $a, array $b): bool {
    $id = primaryMediaId($a);
    return $id !== null && ($a['type'] ?? null) === ($b['type'] ?? null) && $id === primaryMediaId($b);
}

function findExistingMediaId(PDO $db, array $media): ?int {
    $id = primaryMediaId($media);
    if ($id === null) {
        return null;
    }
    $field = primaryMediaIdField($media['type']);
    $stmt = $db->prepare("SELECT id FROM media WHERE type = ? AND $field = ?");
    $stmt->execute([$media['type'], $id]);
    $existing = $stmt->fetchColumn();
    return $existing === false ? null : (int)$existing;
}
?>
