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

function describeRegexError(string $detail): string {
    $detail = preg_replace('/ at offset \d+$/', '', $detail);
    $hints = [
        '/lookbehind assertion is not (fixed length|limited)/' => 'Ein Lookbehind „(?<=…)“ darf keine beliebig lange Wiederholung wie * oder + enthalten. '
            . 'Tipp: Lookbehind weglassen und den gewünschten Teil in Klammern setzen, z. B. „Tatort:\s*(.+)“ statt „(?<=Tatort:\s*).+“.',
        '/missing closing parenthesis/' => 'Es fehlt eine schließende Klammer „)“.',
        '/unmatched closing parenthesis/' => 'Es gibt eine schließende Klammer „)“ zu viel.',
        '/missing terminating \] for character class/' => 'Es fehlt eine schließende eckige Klammer „]“.',
        '/quantifier does not follow a repeatable item/' => 'Ein Wiederholungszeichen (*, +, ? oder {…}) steht an einer Stelle, an der nichts wiederholt werden kann.',
        '/\\\\ at end of pattern/' => 'Das Muster endet mit einem einzelnen Backslash „\\“.',
        '/range out of order in character class/' => 'Ein Bereich in eckigen Klammern ist verdreht, z. B. „[z-a]“ statt „[a-z]“.',
    ];
    foreach ($hints as $pattern => $hint) {
        if (preg_match($pattern, $detail)) {
            return $hint;
        }
    }
    return "Das Muster ist kein gültiger regulärer Ausdruck ($detail).";
}

function validateRegex(string $pattern, string $label, string $prefix = ''): void {
    if (@preg_match("\x01" . $pattern . "\x01", '') === false) {
        $detail = preg_replace('/^preg_match\(\): (Compilation failed: )?/', '', error_get_last()['message'] ?? 'invalid pattern');
        errorResponse("{$prefix}{$label}: " . describeRegexError($detail), 400);
    }
}

function validateRulesetInput(PDO $db, array $input, string $prefix = ''): void {
    if (array_key_exists('topic', $input) && (!is_string($input['topic']) || trim($input['topic']) === '')) {
        errorResponse("{$prefix}Bitte mindestens ein Topic angeben.", 400);
    }
    if (array_key_exists('matchingStrategy', $input) && !in_array($input['matchingStrategy'], MATCHING_STRATEGIES, true)) {
        errorResponse("{$prefix}Bitte eine Matching-Strategie auswählen.", 400);
    }
    if (array_key_exists('priority', $input) && !is_int($input['priority'])) {
        errorResponse("{$prefix}Die Priorität muss eine ganze Zahl sein.", 400);
    }
    if (array_key_exists('mediaId', $input) && $input['mediaId'] !== null) {
        if (!is_int($input['mediaId'])) {
            errorResponse("{$prefix}Die Serie bzw. der Film ist ungültig.", 400);
        }
        $stmt = $db->prepare('SELECT id FROM media WHERE id = ?');
        $stmt->execute([$input['mediaId']]);
        if (!$stmt->fetch()) {
            errorResponse("{$prefix}Die Serie bzw. der Film wurde nicht gefunden. Bitte die Seite neu laden.", 404);
        }
    }
    foreach (['seasonRegex' => 'Staffel-Regex', 'episodeRegex' => 'Episoden-Regex'] as $field => $label) {
        $value = $input[$field] ?? null;
        if ($value === null) {
            continue;
        }
        if (!is_string($value)) {
            errorResponse("{$prefix}{$label}: Bitte ein Muster als Text eingeben.", 400);
        }
        if ($value !== '') {
            validateRegex($value, $label, $prefix);
        }
    }
    if (array_key_exists('filters', $input)) {
        if (!is_array($input['filters']) || !array_is_list($input['filters'])) {
            errorResponse("{$prefix}Die Filter konnten nicht gelesen werden. Bitte die Seite neu laden und erneut versuchen.", 400);
        }
        foreach ($input['filters'] as $i => $f) {
            $label = 'Filter ' . ($i + 1);
            if (!is_array($f) || !in_array($f['attribute'] ?? null, FILTER_ATTRIBUTES, true)) {
                errorResponse("{$prefix}{$label}: Bitte ein Attribut auswählen (Dauer, Sender, Topic, Titel oder Beschreibung).", 400);
            }
            if (!in_array($f['type'] ?? null, FILTER_TYPES, true)) {
                errorResponse("{$prefix}{$label}: Bitte eine Bedingung auswählen.", 400);
            }
            if (!is_string($f['value'] ?? null) || trim($f['value']) === '') {
                errorResponse("{$prefix}{$label}: Bitte einen Wert eingeben.", 400);
            }
            if ($f['type'] === 'Regex') {
                validateRegex($f['value'], $label, $prefix);
            }
            // Only plain decimals, so the editor preview (JS) and MediathekArr (.NET) parse them identically
            if (($f['attribute'] === 'duration' || in_array($f['type'], ['GreaterThan', 'LessThan'], true))
                && !preg_match('/^\d+(\.\d+)?$/D', $f['value'])) {
                errorResponse("{$prefix}{$label}: „{$f['value']}“ ist keine gültige Zahl. Bitte z. B. 30 oder 42.5 eingeben (Punkt statt Komma).", 400);
            }
        }
    }
    if (array_key_exists('titleRegexRules', $input)) {
        if (!is_array($input['titleRegexRules']) || !array_is_list($input['titleRegexRules'])) {
            errorResponse("{$prefix}Die Titel-Regeln konnten nicht gelesen werden. Bitte die Seite neu laden und erneut versuchen.", 400);
        }
        foreach ($input['titleRegexRules'] as $i => $r) {
            $label = 'Titel-Regel ' . ($i + 1);
            if (($r['type'] ?? null) === 'static') {
                if (!is_string($r['value'] ?? null)) {
                    errorResponse("{$prefix}{$label}: Bitte einen statischen Text eingeben.", 400);
                }
            } elseif (($r['type'] ?? null) === 'regex') {
                if (!in_array($r['field'] ?? null, RULE_FIELDS, true)) {
                    errorResponse("{$prefix}{$label}: Bitte ein Feld auswählen (Titel, Topic, Beschreibung oder Sender).", 400);
                }
                if (!is_string($r['pattern'] ?? null) || $r['pattern'] === '') {
                    errorResponse("{$prefix}{$label}: Bitte ein Regex-Muster eingeben.", 400);
                }
                validateRegex($r['pattern'], $label, $prefix);
            } else {
                errorResponse("{$prefix}{$label}: Bitte „Regex-Extraktion“ oder „Statischer Text“ auswählen.", 400);
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
        errorResponse($prefix . 'Bitte als Typ „Serie“ oder „Film“ auswählen.', 400);
    }
    foreach (['tvdbId' => 'TVDB-ID', 'tmdbId' => 'TMDB-ID'] as $field => $label) {
        if (($media[$field] ?? null) !== null && !is_int($media[$field])) {
            errorResponse($prefix . "Die $label muss eine Zahl sein.", 400);
        }
    }
    if (($media['imdbId'] ?? null) !== null && !is_string($media['imdbId'])) {
        errorResponse($prefix . 'Die IMDB-ID muss ein Text sein, z. B. tt1234567.', 400);
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
