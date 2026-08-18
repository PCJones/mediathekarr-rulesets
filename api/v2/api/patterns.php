<?php

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

$db = getDatabase();
$method = $_SERVER['REQUEST_METHOD'];

$pathInfo = trim($_SERVER['PATH_INFO'] ?? '', '/');
$pathParts = explode('/', $pathInfo);

switch ($method) {
    case 'GET':
        handleGet($db);
        break;
    case 'POST':
        handlePost($db, $pathParts[0] ?? '');
        break;
    case 'PUT':
        handlePut($db, $pathParts[0] ?? '', $pathParts[1] ?? null);
        break;
    case 'DELETE':
        handleDelete($db, $pathParts[0] ?? '', $pathParts[1] ?? null);
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handleGet(PDO $db): void {
    $includeInactive = !empty($_GET['includeInactive']);
    if ($includeInactive) {
        requireAdmin();
    }
    $where = $includeInactive ? '' : 'WHERE is_active = 1';

    $titleStmt = $db->query("
        SELECT * FROM predefined_title_patterns
        $where
        ORDER BY sort_order, name
    ");
    $titlePatterns = $titleStmt->fetchAll();

    $seStmt = $db->query("
        SELECT * FROM predefined_season_episode_patterns
        $where
        ORDER BY sort_order, name
    ");
    $sePatterns = $seStmt->fetchAll();

    successResponse([
        'titlePatterns' => array_map('formatTitlePattern', $titlePatterns),
        'seasonEpisodePatterns' => array_map('formatSeasonEpisodePattern', $sePatterns)
    ]);
}

function handlePost(PDO $db, string $type): void {
    requireAdmin();
    $input = getJsonInput();

    if ($type === 'title') {
        validateRequired($input, ['name', 'pattern']);
        validateRegex($input['pattern'], 'pattern');

        $stmt = $db->prepare('
            INSERT INTO predefined_title_patterns (name, pattern, description, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $input['name'],
            $input['pattern'],
            $input['description'] ?? null,
            $input['sortOrder'] ?? 0,
            $input['isActive'] ?? 1
        ]);

        $id = $db->lastInsertId();
        $stmt = $db->prepare('SELECT * FROM predefined_title_patterns WHERE id = ?');
        $stmt->execute([$id]);
        $pattern = $stmt->fetch();

        successResponse(formatTitlePattern($pattern));

    } elseif ($type === 'season-episode') {
        validateRequired($input, ['name']);

        if (empty($input['seasonPattern']) && empty($input['episodePattern'])) {
            errorResponse('At least one of seasonPattern or episodePattern required', 400);
        }

        if (!empty($input['seasonPattern'])) validateRegex($input['seasonPattern'], 'seasonPattern');
        if (!empty($input['episodePattern'])) validateRegex($input['episodePattern'], 'episodePattern');

        $stmt = $db->prepare('
            INSERT INTO predefined_season_episode_patterns
            (name, season_pattern, episode_pattern, description, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $input['name'],
            $input['seasonPattern'] ?? null,
            $input['episodePattern'] ?? null,
            $input['description'] ?? null,
            $input['sortOrder'] ?? 0,
            $input['isActive'] ?? 1
        ]);

        $id = $db->lastInsertId();
        $stmt = $db->prepare('SELECT * FROM predefined_season_episode_patterns WHERE id = ?');
        $stmt->execute([$id]);
        $pattern = $stmt->fetch();

        successResponse(formatSeasonEpisodePattern($pattern));

    } else {
        errorResponse('Invalid pattern type. Use /title or /season-episode', 400);
    }
}

function handlePut(PDO $db, string $type, ?string $id): void {
    requireAdmin();

    if (!$id || !is_numeric($id)) {
        errorResponse('Pattern ID required', 400);
    }

    $input = getJsonInput();

    if ($type === 'title') {
        $stmt = $db->prepare('SELECT id FROM predefined_title_patterns WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            errorResponse('Pattern not found', 404);
        }

        $updateFields = [];
        $params = [];

        if (array_key_exists('pattern', $input)) validateRegex($input['pattern'], 'pattern');

        foreach (['name', 'pattern', 'description'] as $field) {
            if (array_key_exists($field, $input)) {
                $updateFields[] = "$field = ?";
                $params[] = $input[$field];
            }
        }

        if (array_key_exists('sortOrder', $input)) {
            $updateFields[] = 'sort_order = ?';
            $params[] = $input['sortOrder'];
        }

        if (array_key_exists('isActive', $input)) {
            $updateFields[] = 'is_active = ?';
            $params[] = $input['isActive'] ? 1 : 0;
        }

        if (empty($updateFields)) {
            errorResponse('No fields to update', 400);
        }

        $params[] = $id;
        $sql = 'UPDATE predefined_title_patterns SET ' . implode(', ', $updateFields) . ' WHERE id = ?';
        $db->prepare($sql)->execute($params);

        $stmt = $db->prepare('SELECT * FROM predefined_title_patterns WHERE id = ?');
        $stmt->execute([$id]);
        successResponse(formatTitlePattern($stmt->fetch()));

    } elseif ($type === 'season-episode') {
        $stmt = $db->prepare('SELECT id FROM predefined_season_episode_patterns WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            errorResponse('Pattern not found', 404);
        }

        $updateFields = [];
        $params = [];

        if (array_key_exists('name', $input)) {
            $updateFields[] = 'name = ?';
            $params[] = $input['name'];
        }
        if (array_key_exists('seasonPattern', $input)) {
            if ($input['seasonPattern']) validateRegex($input['seasonPattern'], 'seasonPattern');
            $updateFields[] = 'season_pattern = ?';
            $params[] = $input['seasonPattern'];
        }
        if (array_key_exists('episodePattern', $input)) {
            if ($input['episodePattern']) validateRegex($input['episodePattern'], 'episodePattern');
            $updateFields[] = 'episode_pattern = ?';
            $params[] = $input['episodePattern'];
        }
        if (array_key_exists('description', $input)) {
            $updateFields[] = 'description = ?';
            $params[] = $input['description'];
        }
        if (array_key_exists('sortOrder', $input)) {
            $updateFields[] = 'sort_order = ?';
            $params[] = $input['sortOrder'];
        }
        if (array_key_exists('isActive', $input)) {
            $updateFields[] = 'is_active = ?';
            $params[] = $input['isActive'] ? 1 : 0;
        }

        if (empty($updateFields)) {
            errorResponse('No fields to update', 400);
        }

        $params[] = $id;
        $sql = 'UPDATE predefined_season_episode_patterns SET ' . implode(', ', $updateFields) . ' WHERE id = ?';
        $db->prepare($sql)->execute($params);

        $stmt = $db->prepare('SELECT * FROM predefined_season_episode_patterns WHERE id = ?');
        $stmt->execute([$id]);
        successResponse(formatSeasonEpisodePattern($stmt->fetch()));

    } else {
        errorResponse('Invalid pattern type', 400);
    }
}

function handleDelete(PDO $db, string $type, ?string $id): void {
    requireAdmin();

    if (!$id || !is_numeric($id)) {
        errorResponse('Pattern ID required', 400);
    }

    if ($type === 'title') {
        $stmt = $db->prepare('DELETE FROM predefined_title_patterns WHERE id = ?');
        $stmt->execute([$id]);
    } elseif ($type === 'season-episode') {
        $stmt = $db->prepare('DELETE FROM predefined_season_episode_patterns WHERE id = ?');
        $stmt->execute([$id]);
    } else {
        errorResponse('Invalid pattern type', 400);
    }

    if ($stmt->rowCount() === 0) {
        errorResponse('Pattern not found', 404);
    }

    successResponse(null, 'Pattern deleted');
}

function formatTitlePattern(array $pattern): array {
    return [
        'id' => (int)$pattern['id'],
        'name' => $pattern['name'],
        'pattern' => $pattern['pattern'],
        'description' => $pattern['description'],
        'sortOrder' => (int)$pattern['sort_order'],
        'isActive' => (bool)$pattern['is_active']
    ];
}

function formatSeasonEpisodePattern(array $pattern): array {
    return [
        'id' => (int)$pattern['id'],
        'name' => $pattern['name'],
        'seasonPattern' => $pattern['season_pattern'],
        'episodePattern' => $pattern['episode_pattern'],
        'description' => $pattern['description'],
        'sortOrder' => (int)$pattern['sort_order'],
        'isActive' => (bool)$pattern['is_active']
    ];
}
?>
