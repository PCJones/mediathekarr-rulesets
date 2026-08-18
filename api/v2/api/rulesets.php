<?php

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

const MATCHING_STRATEGIES = [
    'SeasonAndEpisodeNumber', 'ByAbsoluteEpisodeNumber', 'AbsoluteEpisodeNumber',
    'ItemTitleExact', 'ItemTitleIncludes', 'ItemTitleEqualsAirdate'
];
const FILTER_ATTRIBUTES = ['duration', 'channel', 'title', 'topic', 'description'];
const FILTER_TYPES = ['GreaterThan', 'LessThan', 'Equals', 'Contains', 'Regex'];
const RULE_FIELDS = ['title', 'topic', 'description', 'channel'];

$db = getDatabase();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($db);
        break;
    case 'POST':
        handlePost($db);
        break;
    case 'PUT':
        handlePut($db);
        break;
    case 'DELETE':
        handleDelete($db);
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handleGet(PDO $db): void {
    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $rulesetId = $pathParts[0] ?? null;

    if ($rulesetId && is_numeric($rulesetId)) {
        $stmt = $db->prepare('
            SELECT r.*, m.name as media_name, m.tvdbId as media_tvdbId
            FROM rulesets r
            LEFT JOIN media m ON r.mediaId = m.id
            WHERE r.id = ?
        ');
        $stmt->execute([$rulesetId]);
        $ruleset = $stmt->fetch();

        if (!$ruleset) {
            errorResponse('Ruleset nicht gefunden', 404);
        }

        successResponse(formatRuleset($ruleset));
    }

    if ($pathParts[0] === 'media' && isset($pathParts[1]) && is_numeric($pathParts[1])) {
        $stmt = $db->prepare('
            SELECT r.*, m.name as media_name, m.tvdbId as media_tvdbId
            FROM rulesets r
            LEFT JOIN media m ON r.mediaId = m.id
            WHERE r.mediaId = ?
            ORDER BY r.priority, r.id
        ');
        $stmt->execute([$pathParts[1]]);
        $rulesets = $stmt->fetchAll();

        successResponse(array_map('formatRuleset', $rulesets));
    }

    if ($rulesetId !== '') {
        errorResponse('Not found', 404);
    }

    $queryParams = [];
    parse_str($_SERVER['QUERY_STRING'] ?? '', $queryParams);

    $page = max(1, intval($queryParams['page'] ?? 1));
    $pageSize = min(100, max(10, intval($queryParams['pageSize'] ?? 50)));
    $offset = ($page - 1) * $pageSize;

    $where = [];
    $params = [];

    if (!empty($queryParams['topic'])) {
        $where[] = 'r.topic LIKE ?';
        $params[] = '%' . $queryParams['topic'] . '%';
    }

    if (!empty($queryParams['matchingStrategy'])) {
        $where[] = 'r.matchingStrategy = ?';
        $params[] = $queryParams['matchingStrategy'];
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $db->prepare("
        SELECT COUNT(*) FROM rulesets r $whereClause
    ");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare("
        SELECT r.*, m.name as media_name, m.tvdbId as media_tvdbId
        FROM rulesets r
        LEFT JOIN media m ON r.mediaId = m.id
        $whereClause
        ORDER BY r.priority, r.id
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([...$params, $pageSize, $offset]);
    $rulesets = $stmt->fetchAll();

    successResponse([
        'rulesets' => array_map('formatRuleset', $rulesets),
        'total' => $total,
        'page' => $page,
        'pageSize' => $pageSize,
        'totalPages' => ceil($total / $pageSize)
    ]);
}

function validateRulesetInput(PDO $db, array $input): void {
    if (array_key_exists('topic', $input) && (!is_string($input['topic']) || trim($input['topic']) === '')) {
        errorResponse('topic must be a non-empty string', 400);
    }
    if (array_key_exists('matchingStrategy', $input) && !in_array($input['matchingStrategy'], MATCHING_STRATEGIES, true)) {
        errorResponse('Invalid matchingStrategy', 400);
    }
    if (array_key_exists('priority', $input) && !is_int($input['priority'])) {
        errorResponse('priority must be an integer', 400);
    }
    if (array_key_exists('mediaId', $input) && $input['mediaId'] !== null) {
        if (!is_int($input['mediaId'])) {
            errorResponse('mediaId must be an integer', 400);
        }
        $stmt = $db->prepare('SELECT id FROM media WHERE id = ?');
        $stmt->execute([$input['mediaId']]);
        if (!$stmt->fetch()) {
            errorResponse('Media not found', 404);
        }
    }
    foreach (['seasonRegex', 'episodeRegex'] as $field) {
        if (!empty($input[$field])) {
            if (!is_string($input[$field])) {
                errorResponse("$field must be a string", 400);
            }
            validateRegex($input[$field], $field);
        }
    }
    if (array_key_exists('filters', $input)) {
        if (!is_array($input['filters']) || !array_is_list($input['filters'])) {
            errorResponse('filters must be an array', 400);
        }
        foreach ($input['filters'] as $i => $f) {
            if (!is_array($f) || !in_array($f['attribute'] ?? null, FILTER_ATTRIBUTES, true)
                || !in_array($f['type'] ?? null, FILTER_TYPES, true) || !is_string($f['value'] ?? null)) {
                errorResponse("Invalid filter at index $i", 400);
            }
            if ($f['type'] === 'Regex') {
                validateRegex($f['value'], "filters[$i].value");
            }
        }
    }
    if (array_key_exists('titleRegexRules', $input)) {
        if (!is_array($input['titleRegexRules']) || !array_is_list($input['titleRegexRules'])) {
            errorResponse('titleRegexRules must be an array', 400);
        }
        foreach ($input['titleRegexRules'] as $i => $r) {
            if (!is_array($r)) {
                errorResponse("Invalid title rule at index $i", 400);
            }
            if (($r['type'] ?? null) === 'static') {
                if (!is_string($r['value'] ?? null)) {
                    errorResponse("Title rule $i: static rule needs a string value", 400);
                }
            } elseif (($r['type'] ?? null) === 'regex') {
                if (!in_array($r['field'] ?? null, RULE_FIELDS, true) || !is_string($r['pattern'] ?? null)) {
                    errorResponse("Title rule $i: regex rule needs field and pattern", 400);
                }
                validateRegex($r['pattern'], "titleRegexRules[$i].pattern");
            } else {
                errorResponse("Title rule $i: type must be 'static' or 'regex'", 400);
            }
        }
    }
}

function handlePost(PDO $db): void {
    $userId = requireAdmin();
    $input = getJsonInput();

    validateRequired($input, ['topic', 'matchingStrategy']);
    validateRulesetInput($db, $input);

    $db->beginTransaction();

    try {
        $stmt = $db->prepare('
            INSERT INTO rulesets
            (mediaId, topic, priority, filters, titleRegexRules, episodeRegex, seasonRegex, matchingStrategy)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');

        $stmt->execute([
            $input['mediaId'] ?? null,
            $input['topic'],
            $input['priority'] ?? 0,
            json_encode($input['filters'] ?? []),
            json_encode($input['titleRegexRules'] ?? []),
            $input['episodeRegex'] ?? null,
            $input['seasonRegex'] ?? null,
            $input['matchingStrategy']
        ]);

        $rulesetId = $db->lastInsertId();

        addChangelogEntry($db, $rulesetId, $userId, 'Ruleset erstellt');

        $db->commit();

        $stmt = $db->prepare('
            SELECT r.*, m.name as media_name, m.tvdbId as media_tvdbId
            FROM rulesets r
            LEFT JOIN media m ON r.mediaId = m.id
            WHERE r.id = ?
        ');
        $stmt->execute([$rulesetId]);
        $ruleset = $stmt->fetch();

        successResponse(formatRuleset($ruleset));

    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

function handleReorder(PDO $db, int $userId): void {
    $input = getJsonInput();
    if (!array_is_list($input) || $input === []) {
        errorResponse('Expected a non-empty array of {id, priority}', 400);
    }
    foreach ($input as $i => $item) {
        if (!is_array($item) || !is_int($item['id'] ?? null) || !is_int($item['priority'] ?? null)) {
            errorResponse("Item $i must have integer id and priority", 400);
        }
    }

    $ids = array_column($input, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare("SELECT id FROM rulesets WHERE id IN ($placeholders)");
    $stmt->execute($ids);
    $missing = array_diff($ids, array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN)));
    if ($missing) {
        errorResponse('Ruleset not found: ' . implode(', ', $missing), 404);
    }

    $db->beginTransaction();
    try {
        $update = $db->prepare('UPDATE rulesets SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        foreach ($input as $item) {
            $update->execute([$item['priority'], $item['id']]);
            addChangelogEntry($db, $item['id'], $userId, 'Priorität geändert: ' . $item['priority']);
        }
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

    $stmt = $db->prepare("
        SELECT r.*, m.name as media_name, m.tvdbId as media_tvdbId
        FROM rulesets r
        LEFT JOIN media m ON r.mediaId = m.id
        WHERE r.id IN ($placeholders)
        ORDER BY r.priority, r.id
    ");
    $stmt->execute($ids);
    successResponse(array_map('formatRuleset', $stmt->fetchAll()));
}

function handlePut(PDO $db): void {
    $userId = requireAdmin();

    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $rulesetId = $pathParts[0] ?? null;

    if ($rulesetId === 'reorder') {
        handleReorder($db, $userId);
    }

    if (!$rulesetId || !is_numeric($rulesetId)) {
        errorResponse('Ruleset-ID erforderlich', 400);
    }

    $stmt = $db->prepare('SELECT * FROM rulesets WHERE id = ?');
    $stmt->execute([$rulesetId]);
    $existing = $stmt->fetch();

    if (!$existing) {
        errorResponse('Ruleset nicht gefunden', 404);
    }

    $input = getJsonInput();
    validateRulesetInput($db, $input);

    $updateFields = [];
    $params = [];

    $allowedFields = [
        'mediaId', 'topic', 'priority', 'filters',
        'titleRegexRules', 'episodeRegex', 'seasonRegex', 'matchingStrategy'
    ];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $input)) {
            $updateFields[] = "$field = ?";

            if (in_array($field, ['filters', 'titleRegexRules'])) {
                $params[] = json_encode($input[$field]);
            } else {
                $params[] = $input[$field];
            }
        }
    }

    if (empty($updateFields)) {
        errorResponse('Keine Felder zum Aktualisieren', 400);
    }

    $updateFields[] = "updated_at = CURRENT_TIMESTAMP";
    $params[] = $rulesetId;

    $db->beginTransaction();

    try {
        $sql = 'UPDATE rulesets SET ' . implode(', ', $updateFields) . ' WHERE id = ?';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        $changes = array_keys(array_filter($input, fn($k) => in_array($k, $allowedFields), ARRAY_FILTER_USE_KEY));
        $summary = 'Aktualisiert: ' . implode(', ', $changes);
        addChangelogEntry($db, $rulesetId, $userId, $summary);

        $db->commit();

        $stmt = $db->prepare('
            SELECT r.*, m.name as media_name, m.tvdbId as media_tvdbId
            FROM rulesets r
            LEFT JOIN media m ON r.mediaId = m.id
            WHERE r.id = ?
        ');
        $stmt->execute([$rulesetId]);
        $ruleset = $stmt->fetch();

        successResponse(formatRuleset($ruleset));

    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

function handleDelete(PDO $db): void {
    $userId = requireAdmin();

    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $rulesetId = $pathParts[0] ?? null;

    if (!$rulesetId || !is_numeric($rulesetId)) {
        errorResponse('Ruleset-ID erforderlich', 400);
    }

    $stmt = $db->prepare('SELECT id, topic FROM rulesets WHERE id = ?');
    $stmt->execute([$rulesetId]);
    $ruleset = $stmt->fetch();

    if (!$ruleset) {
        errorResponse('Ruleset nicht gefunden', 404);
    }

    $db->beginTransaction();
    addChangelogEntry($db, (int)$rulesetId, $userId, 'Ruleset gelöscht: ' . $ruleset['topic']);
    $db->prepare('DELETE FROM rulesets WHERE id = ?')->execute([$rulesetId]);
    $db->commit();

    successResponse(null, 'Ruleset gelöscht');
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

function addChangelogEntry(PDO $db, int $rulesetId, int $userId, string $summary): void {
    $stmt = $db->prepare('SELECT username FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    $username = $user['username'] ?? 'unknown';

    $stmt = $db->prepare('
        INSERT INTO ruleset_changelog (ruleset_id, changed_by, change_summary)
        VALUES (?, ?, ?)
    ');
    $stmt->execute([$rulesetId, $username, $summary]);
}
?>
