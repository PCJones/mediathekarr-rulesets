<?php
require_once '../config.php';
require_once '../api/middleware.php';

$db = new PDO('sqlite:' . DB_PATH);
$userId = authenticate();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->query('SELECT * FROM media');
    $media = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($media);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    $stmt = $db->prepare('
        INSERT INTO media (name, type, tmdbId, imdbId, tvdbId)
        VALUES (:name, :type, :tmdbId, :imdbId, :tvdbId)
    ');

    $stmt->execute([
        ':name' => $input['name'],
        ':type' => $input['type'], // 'movie' or 'show'
        ':tmdbId' => $input['tmdbId'] ?? null,
        ':imdbId' => $input['imdbId'] ?? null,
        ':tvdbId' => $input['tvdbId'] ?? null,
    ]);

    echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
    $mediaId = $queryParams['id'] ?? null;

    if (!$mediaId) {
        http_response_code(400);
        die(json_encode(['error' => 'Media ID is required']));
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $stmt = $db->prepare('
        UPDATE media
        SET name = :name, type = :type, tmdbId = :tmdbId, imdbId = :imdbId, tvdbId = :tvdbId
        WHERE id = :id
    ');

    $stmt->execute([
        ':id' => $mediaId,
        ':name' => $input['name'],
        ':type' => $input['type'],
        ':tmdbId' => $input['tmdbId'] ?? null,
        ':imdbId' => $input['imdbId'] ?? null,
        ':tvdbId' => $input['tvdbId'] ?? null,
    ]);

    echo json_encode(['success' => true]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
    $mediaId = $queryParams['id'] ?? null;

    if (!$mediaId) {
        http_response_code(400);
        die(json_encode(['error' => 'Media ID is required']));
    }

    $stmt = $db->prepare('DELETE FROM media WHERE id = :id');
    $stmt->execute([':id' => $mediaId]);

    echo json_encode(['success' => true]);
}
?>
