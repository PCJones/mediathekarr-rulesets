<?php
require_once '../config.php';
require_once '../api/middleware.php';

$db = new PDO('sqlite:' . DB_PATH);
header('Content-Type: application/json');

// Check the request method
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
    $mediaId = $queryParams['mediaId'] ?? null;

    if ($mediaId) {
        // Authenticate only for specific mediaId requests
        $userId = authenticate();

        // Retrieve rulesets for a specific mediaId
        $stmt = $db->prepare('SELECT * FROM rulesets WHERE mediaId = :mediaId ORDER BY priority');
        $stmt->execute([':mediaId' => $mediaId]);
        $rulesets = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rulesets);
    } else {
        // Public access for retrieving all rulesets with pagination
        $page = $queryParams['page'] ?? 1;
        $page = max(1, intval($page));
        $itemsPerPage = 500;
        $offset = ($page - 1) * $itemsPerPage;

        // Retrieve all rulesets and their associated media details
        $stmt = $db->prepare('
            SELECT r.*, 
                   m.id AS media_id, 
                   m.name AS media_name, 
                   m.type AS media_type, 
                   m.tmdbId AS media_tmdbId, 
                   m.imdbId AS media_imdbId, 
                   m.tvdbId AS media_tvdbId
            FROM rulesets r
            JOIN media m ON r.mediaId = m.id
            ORDER BY r.priority
            LIMIT :limit OFFSET :offset
        ');
        $stmt->bindValue(':limit', $itemsPerPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rulesets = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Count total items for pagination metadata
        $countStmt = $db->query('SELECT COUNT(*) FROM rulesets');
        $totalItems = $countStmt->fetchColumn();

        // Structure the response with nested media object
        $rulesetsWithMedia = array_map(function ($ruleset) {
            return [
                'id' => $ruleset['id'],
                'mediaId' => $ruleset['mediaId'],
                'topic' => $ruleset['topic'],
                'priority' => $ruleset['priority'],
                'filters' => $ruleset['filters'],
                'titleRegexRules' => $ruleset['titleRegexRules'],
                'episodeRegex' => $ruleset['episodeRegex'],
                'seasonRegex' => $ruleset['seasonRegex'],
                'matchingStrategy' => $ruleset['matchingStrategy'],
                'media' => [
                    'media_id' => $ruleset['media_id'],
                    'media_name' => $ruleset['media_name'],
                    'media_type' => $ruleset['media_type'],
					'media_tmdbId' => !empty($ruleset['media_tmdbId']) ? intval($ruleset['media_tmdbId']) : null,
					'media_imdbId' => !empty($ruleset['media_imdbId']) ? $ruleset['media_imdbId'] : null,
					'media_tvdbId' => !empty($ruleset['media_tvdbId']) ? intval($ruleset['media_tvdbId']) : null,
                ],
            ];
        }, $rulesets);

        echo json_encode([
            'rulesets' => $rulesetsWithMedia,
            'pagination' => [
                'currentPage' => $page,
                'totalPages' => ceil($totalItems / $itemsPerPage),
                'totalItems' => $totalItems,
                'itemsPerPage' => $itemsPerPage,
            ],
        ]);
    }
}


if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Authenticate for POST requests
    $userId = authenticate();
    $input = json_decode(file_get_contents('php://input'), true);

    if (isset($input['id'])) {
        // Update an existing ruleset
        $stmt = $db->prepare('
            UPDATE rulesets 
            SET mediaId = :mediaId, topic = :topic, priority = :priority, filters = :filters, 
                titleRegexRules = :titleRegexRules, episodeRegex = :episodeRegex, 
                seasonRegex = :seasonRegex, matchingStrategy = :matchingStrategy
            WHERE id = :id
        ');

        $stmt->execute([
            ':id' => $input['id'],
            ':mediaId' => $input['mediaId'],
            ':topic' => $input['topic'],
            ':priority' => $input['priority'],
            ':filters' => json_encode($input['filters']),
            ':titleRegexRules' => json_encode($input['titleRegexRules']),
            ':episodeRegex' => $input['episodeRegex'],
            ':seasonRegex' => $input['seasonRegex'],
            ':matchingStrategy' => $input['matchingStrategy'],
        ]);

        echo json_encode(['success' => true, 'id' => $input['id']]);
    } else {
        // Create a new ruleset
        $stmt = $db->prepare('
            INSERT INTO rulesets (mediaId, topic, priority, filters, titleRegexRules, episodeRegex, seasonRegex, matchingStrategy)
            VALUES (:mediaId, :topic, :priority, :filters, :titleRegexRules, :episodeRegex, :seasonRegex, :matchingStrategy)
        ');

        $stmt->execute([
            ':mediaId' => $input['mediaId'],
            ':topic' => $input['topic'],
            ':priority' => $input['priority'],
            ':filters' => json_encode($input['filters']),
            ':titleRegexRules' => json_encode($input['titleRegexRules']),
            ':episodeRegex' => $input['episodeRegex'],
            ':seasonRegex' => $input['seasonRegex'],
            ':matchingStrategy' => $input['matchingStrategy'],
        ]);

        echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    // Authenticate for DELETE requests
    $userId = authenticate();
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
    $rulesetId = $queryParams['id'] ?? null;

    if (!$rulesetId) {
        http_response_code(400);
        die(json_encode(['error' => 'Ruleset ID is required']));
    }

    $stmt = $db->prepare('DELETE FROM rulesets WHERE id = :id');
    $stmt->execute([':id' => $rulesetId]);

    echo json_encode(['success' => true]);
}
?>
