<?php

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/ruleset_validation.php';

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
        $ruleset = loadRulesetWithMedia($db, (int)$rulesetId);

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

function handlePost(PDO $db): void {
    requireAdmin();
    $input = getJsonInput();

    validateRequired($input, ['topic', 'matchingStrategy']);
    validateRulesetInput($db, $input);

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

    successResponse(formatRuleset(loadRulesetWithMedia($db, (int)$db->lastInsertId())));
}

function loadRulesetWithMedia(PDO $db, int $rulesetId): ?array {
    $stmt = $db->prepare('
        SELECT r.*, m.name as media_name, m.tvdbId as media_tvdbId
        FROM rulesets r
        LEFT JOIN media m ON r.mediaId = m.id
        WHERE r.id = ?
    ');
    $stmt->execute([$rulesetId]);
    return $stmt->fetch() ?: null;
}

function handleReorder(PDO $db): void {
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
    requireAdmin();

    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $rulesetId = $pathParts[0] ?? null;

    if ($rulesetId === 'reorder') {
        handleReorder($db);
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

    $db->prepare('UPDATE rulesets SET ' . implode(', ', $updateFields) . ' WHERE id = ?')->execute($params);

    successResponse(formatRuleset(loadRulesetWithMedia($db, (int)$rulesetId)));
}

function handleDelete(PDO $db): void {
    requireAdmin();

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

    $db->prepare('DELETE FROM rulesets WHERE id = ?')->execute([$rulesetId]);

    successResponse(null, 'Ruleset gelöscht');
}
?>
