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
    $mediaId = $pathParts[0] ?? null;

    if ($mediaId && is_numeric($mediaId)) {
        $stmt = $db->prepare('SELECT * FROM media WHERE id = ?');
        $stmt->execute([$mediaId]);
        $media = $stmt->fetch();

        if (!$media) {
            errorResponse('Media not found', 404);
        }

        successResponse(formatMedia($media));
    }

    if ($mediaId !== '') {
        errorResponse('Not found', 404);
    }

    $query = [];
    parse_str($_SERVER['QUERY_STRING'] ?? '', $query);

    if (!empty($query['withSuggestionCounts'])) {
        $stmt = $db->query("
            SELECT m.*, (SELECT COUNT(*) FROM suggestions s WHERE s.media_id = m.id AND s.status = 'open') AS open_suggestions
            FROM media m
            ORDER BY m.name
        ");
        successResponse(array_map(
            fn($row) => formatMedia($row) + ['openSuggestions' => (int)$row['open_suggestions']],
            $stmt->fetchAll()
        ));
    }

    $stmt = $db->query('SELECT * FROM media ORDER BY name');
    $media = $stmt->fetchAll();
    successResponse(array_map('formatMedia', $media));
}

function handlePost(PDO $db): void {
    requireAdmin();
    $input = getJsonInput();
    validateRequired($input, ['name', 'type']);
    validateMediaInput($input);
    if (findExistingMediaId($db, $input) !== null) {
        errorResponse('Dieses Medium existiert bereits', 409);
    }

    $stmt = $db->prepare('
        INSERT INTO media (name, type, tmdbId, imdbId, tvdbId)
        VALUES (?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $input['name'],
        $input['type'],
        $input['tmdbId'] ?? null,
        $input['imdbId'] ?? null,
        $input['tvdbId'] ?? null,
    ]);

    successResponse(['id' => (int)$db->lastInsertId()], 'Media created');
}

function handlePut(PDO $db): void {
    requireAdmin();

    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $mediaId = $pathParts[0] ?? null;

    if (!$mediaId || !is_numeric($mediaId)) {
        errorResponse('Media ID required', 400);
    }

    $stmt = $db->prepare('SELECT * FROM media WHERE id = ?');
    $stmt->execute([$mediaId]);
    $existing = $stmt->fetch();
    if (!$existing) {
        errorResponse('Media not found', 404);
    }

    $input = getJsonInput();

    $updateFields = [];
    $params = [];

    $allowedFields = ['name', 'type', 'tmdbId', 'imdbId', 'tvdbId'];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $input)) {
            $updateFields[] = "$field = ?";
            $params[] = $input[$field];
        }
    }

    if (empty($updateFields)) {
        errorResponse('No fields to update', 400);
    }

    if (array_intersect(['type', 'tvdbId', 'tmdbId', 'imdbId'], array_keys($input))) {
        $merged = array_merge($existing, array_intersect_key($input, array_flip($allowedFields)));
        validateMediaInput($merged);
        $duplicateId = findExistingMediaId($db, $merged);
        if ($duplicateId !== null && $duplicateId !== (int)$mediaId) {
            errorResponse('Dieses Medium existiert bereits', 409);
        }
    }

    $params[] = $mediaId;
    $sql = 'UPDATE media SET ' . implode(', ', $updateFields) . ' WHERE id = ?';
    $db->prepare($sql)->execute($params);

    successResponse(null, 'Media updated');
}

function handleDelete(PDO $db): void {
    $userId = requireAdmin();

    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $mediaId = $pathParts[0] ?? null;

    if (!$mediaId || !is_numeric($mediaId)) {
        errorResponse('Media ID required', 400);
    }

    $stmt = $db->prepare('SELECT id FROM media WHERE id = ?');
    $stmt->execute([$mediaId]);
    if (!$stmt->fetch()) {
        errorResponse('Media not found', 404);
    }

    $db->beginTransaction();
    $db->prepare("
        UPDATE suggestions
        SET status = 'withdrawn', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP,
            resolution_comment = 'Medium wurde gelöscht', updated_at = CURRENT_TIMESTAMP
        WHERE media_id = ? AND status = 'open'
    ")->execute([$userId, $mediaId]);
    $db->prepare('DELETE FROM rulesets WHERE mediaId = ?')->execute([$mediaId]);
    $db->prepare('DELETE FROM media WHERE id = ?')->execute([$mediaId]);
    $db->commit();

    successResponse(null, 'Media deleted');
}

function formatMedia(array $media): array {
    return [
        'id' => (int)$media['id'],
        'name' => $media['name'],
        'type' => $media['type'],
        'tmdbId' => $media['tmdbId'] !== null ? (int)$media['tmdbId'] : null,
        'imdbId' => $media['imdbId'],
        'tvdbId' => $media['tvdbId'] !== null ? (int)$media['tvdbId'] : null,
    ];
}
?>
