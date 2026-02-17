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

    $stmt = $db->query('SELECT * FROM media ORDER BY name');
    $media = $stmt->fetchAll();
    successResponse(array_map('formatMedia', $media));
}

function handlePost(PDO $db): void {
    authenticate();
    $input = getJsonInput();
    validateRequired($input, ['name', 'type']);

    if (!in_array($input['type'], ['movie', 'show'])) {
        errorResponse('Type must be "movie" or "show"', 400);
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
    authenticate();

    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $mediaId = $pathParts[0] ?? null;

    if (!$mediaId || !is_numeric($mediaId)) {
        errorResponse('Media ID required', 400);
    }

    $stmt = $db->prepare('SELECT * FROM media WHERE id = ?');
    $stmt->execute([$mediaId]);
    if (!$stmt->fetch()) {
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

    if (isset($input['type']) && !in_array($input['type'], ['movie', 'show'])) {
        errorResponse('Type must be "movie" or "show"', 400);
    }

    $params[] = $mediaId;
    $sql = 'UPDATE media SET ' . implode(', ', $updateFields) . ' WHERE id = ?';
    $db->prepare($sql)->execute($params);

    successResponse(null, 'Media updated');
}

function handleDelete(PDO $db): void {
    authenticate();

    $pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
    $mediaId = $pathParts[0] ?? null;

    if (!$mediaId || !is_numeric($mediaId)) {
        errorResponse('Media ID required', 400);
    }

    $stmt = $db->prepare('DELETE FROM media WHERE id = ?');
    $stmt->execute([$mediaId]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Media not found', 404);
    }

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
