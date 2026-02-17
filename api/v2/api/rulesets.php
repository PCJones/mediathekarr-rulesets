<?php

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

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
            ORDER BY r.priority
        ');
        $stmt->execute([$pathParts[1]]);
        $rulesets = $stmt->fetchAll();

        successResponse(array_map('formatRuleset', $rulesets));
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
        ORDER BY r.priority
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

function handlePost(PDO $db): void {
    $userId = authenticate();
    $input = getJsonInput();

    validateRequired($input, ['topic', 'matchingStrategy']);

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
        errorResponse('Fehler beim Erstellen: ' . $e->getMessage(), 500);
    }
}

function handlePut(PDO $db): void {
    $userId = authenticate();

    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $rulesetId = $pathParts[0] ?? null;

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
        errorResponse('Fehler beim Aktualisieren: ' . $e->getMessage(), 500);
    }
}

function handleDelete(PDO $db): void {
    $userId = authenticate();

    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $rulesetId = $pathParts[0] ?? null;

    if (!$rulesetId || !is_numeric($rulesetId)) {
        errorResponse('Ruleset-ID erforderlich', 400);
    }

    $stmt = $db->prepare('SELECT id FROM rulesets WHERE id = ?');
    $stmt->execute([$rulesetId]);

    if (!$stmt->fetch()) {
        errorResponse('Ruleset nicht gefunden', 404);
    }

    $stmt = $db->prepare('DELETE FROM rulesets WHERE id = ?');
    $stmt->execute([$rulesetId]);

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
    $stmt = $db->prepare('SELECT email FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    $userEmail = $user['email'] ?? 'unknown';

    $stmt = $db->prepare('
        INSERT INTO ruleset_changelog (ruleset_id, changed_by, change_summary)
        VALUES (?, ?, ?)
    ');
    $stmt->execute([$rulesetId, $userEmail, $summary]);
}
?>
