<?php

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/ruleset_validation.php';

const SUGGESTION_PAGE_SIZE = 20;
const SUGGESTION_STATUSES = ['open', 'accepted', 'rejected', 'withdrawn'];

$db = getDatabase();
$method = $_SERVER['REQUEST_METHOD'];
$path = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
$seg0 = $path[0] ?? '';
$seg1 = $path[1] ?? null;
$seg2 = $path[2] ?? null;

switch ($method) {
    case 'GET':
        if ($seg0 === '') {
            handleList($db);
        }
        if ($seg0 === 'media' && $seg1 !== null && ctype_digit($seg1)) {
            handleMediaSuggestions($db, (int)$seg1);
        }
        if (ctype_digit($seg0)) {
            if ($seg1 === null) {
                handleDetail($db, (int)$seg0);
            }
            if ($seg1 === 'comments' && $seg2 === null) {
                handleListComments($db, (int)$seg0);
            }
            if ($seg1 === 'revisions' && $seg2 !== null && ctype_digit($seg2)) {
                handleGetRevision($db, (int)$seg0, (int)$seg2);
            }
        }
        break;

    case 'POST':
        if ($seg0 === '') {
            handleCreate($db);
        }
        if (ctype_digit($seg0)) {
            if ($seg1 === 'comments' && $seg2 === null) {
                handleAddComment($db, (int)$seg0);
            }
            if ($seg1 === 'withdraw') {
                handleWithdraw($db, (int)$seg0);
            }
            if ($seg1 === 'reject') {
                handleReject($db, (int)$seg0);
            }
            if ($seg1 === 'accept') {
                handleAccept($db, (int)$seg0);
            }
        }
        break;

    case 'PUT':
        if (ctype_digit($seg0)) {
            if ($seg1 === null) {
                handleRevise($db, (int)$seg0);
            }
            if ($seg1 === 'vote') {
                handleVote($db, (int)$seg0, true);
            }
            if ($seg1 === 'comments' && $seg2 !== null && ctype_digit($seg2)) {
                handleEditComment($db, (int)$seg0, (int)$seg2);
            }
        }
        break;

    case 'DELETE':
        if (ctype_digit($seg0)) {
            if ($seg1 === 'vote') {
                handleVote($db, (int)$seg0, false);
            }
            if ($seg1 === 'comments' && $seg2 !== null && ctype_digit($seg2)) {
                handleDeleteComment($db, (int)$seg0, (int)$seg2);
            }
        }
        break;

    default:
        errorResponse('Method not allowed', 405);
}

errorResponse('Not found', 404);

function suggestionSelect(): string {
    return "
        SELECT s.*,
               u.username AS author_username,
               m.name AS media_name, m.type AS media_type, m.tvdbId AS media_tvdbId,
               ru.username AS resolver_username,
               rev.description AS rev_description, rev.bundle AS rev_bundle,
               (SELECT COUNT(*) FROM suggestion_votes v WHERE v.suggestion_id = s.id) AS vote_count,
               (SELECT COUNT(*) FROM suggestion_comments c WHERE c.suggestion_id = s.id AND c.deleted_at IS NULL) AS comment_count,
               (SELECT COUNT(*) FROM suggestion_votes v WHERE v.suggestion_id = s.id AND v.user_id = ?) AS has_voted
        FROM suggestions s
        JOIN users u ON u.id = s.author_id
        LEFT JOIN users ru ON ru.id = s.resolved_by
        LEFT JOIN media m ON m.id = s.media_id
        JOIN suggestion_revisions rev ON rev.suggestion_id = s.id AND rev.number = s.current_revision
    ";
}

function loadSuggestionRow(PDO $db, int $id, ?int $viewerId): array {
    $stmt = $db->prepare(suggestionSelect() . ' WHERE s.id = ?');
    $stmt->execute([$viewerId ?? 0, $id]);
    $row = $stmt->fetch();
    if (!$row) {
        errorResponse('Vorschlag nicht gefunden', 404);
    }
    return $row;
}

function decodeBundle(?string $json): array {
    $bundle = json_decode($json ?? '', true);
    if (!is_array($bundle)) {
        $bundle = [];
    }
    return [
        'changes' => is_array($bundle['changes'] ?? null) ? $bundle['changes'] : [],
        'order' => is_array($bundle['order'] ?? null) ? $bundle['order'] : null,
        'coverage' => is_array($bundle['coverage'] ?? null) ? $bundle['coverage'] : null,
    ];
}

function changeCounts(array $changes): array {
    $counts = ['create' => 0, 'update' => 0, 'delete' => 0];
    foreach ($changes as $change) {
        $op = $change['op'] ?? '';
        if (isset($counts[$op])) {
            $counts[$op]++;
        }
    }
    return $counts;
}

function touchedRulesetIds(array $changes): array {
    $ids = [];
    foreach ($changes as $change) {
        if (isset($change['rulesetId']) && is_int($change['rulesetId'])) {
            $ids[] = $change['rulesetId'];
        }
    }
    return array_values(array_unique($ids));
}

function liveRuleset(PDO $db, int $rulesetId): ?array {
    $stmt = $db->prepare('SELECT * FROM rulesets WHERE id = ?');
    $stmt->execute([$rulesetId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function computeStale(PDO $db, array $row, array $bundle): array {
    if ($row['status'] !== 'open') {
        return [];
    }

    $stale = [];
    $mediaId = $row['media_id'] === null ? null : (int)$row['media_id'];

    if ($row['media_id'] === null) {
        $proposed = json_decode($row['proposed_media'] ?? '', true);
        if (!is_array($proposed)) {
            $stale[] = ['key' => null, 'reason' => 'media_missing'];
        } elseif (findExistingMediaId($db, $proposed) !== null) {
            $stale[] = ['key' => null, 'reason' => 'media_exists'];
        }
    }

    foreach ($bundle['changes'] as $change) {
        $op = $change['op'] ?? '';
        if ($op !== 'update' && $op !== 'delete') {
            continue;
        }
        $live = liveRuleset($db, (int)($change['rulesetId'] ?? 0));
        if (!$live || ($live['mediaId'] === null ? null : (int)$live['mediaId']) !== $mediaId) {
            $stale[] = ['key' => $change['key'] ?? null, 'reason' => 'ruleset_missing'];
            continue;
        }
        if (rulesetHash(formatRuleset($live)) !== ($change['base']['hash'] ?? '')) {
            $stale[] = ['key' => $change['key'] ?? null, 'reason' => 'ruleset_changed'];
        }
    }

    return $stale;
}

function formatSummary(array $row, array $bundle, array $stale): array {
    $proposed = json_decode($row['proposed_media'] ?? '', true);

    return [
        'id' => (int)$row['id'],
        'status' => $row['status'],
        'media' => $row['media_id'] === null ? null : [
            'id' => (int)$row['media_id'],
            'name' => $row['media_name'],
            'type' => $row['media_type'],
            'tvdbId' => $row['media_tvdbId'] !== null ? (int)$row['media_tvdbId'] : null,
        ],
        'proposedMedia' => is_array($proposed) ? $proposed : null,
        'author' => ['id' => (int)$row['author_id'], 'username' => $row['author_username']],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
        'currentRevision' => (int)$row['current_revision'],
        'changeCounts' => changeCounts($bundle['changes']),
        'touchedRulesetIds' => touchedRulesetIds($bundle['changes']),
        'coverage' => $bundle['coverage'],
        'votes' => (int)$row['vote_count'],
        'hasVoted' => (int)$row['has_voted'] > 0,
        'comments' => (int)$row['comment_count'],
        'isStale' => $stale !== [],
    ];
}

function formatDetail(PDO $db, array $row): array {
    $bundle = decodeBundle($row['rev_bundle']);
    $stale = computeStale($db, $row, $bundle);
    $detail = formatSummary($row, $bundle, $stale);

    $detail['description'] = $row['rev_description'];
    $detail['bundle'] = $bundle;
    $detail['stale'] = $stale;

    $stmt = $db->prepare('
        SELECT r.number, r.created_at, r.bundle, u.username
        FROM suggestion_revisions r
        JOIN users u ON u.id = r.author_id
        WHERE r.suggestion_id = ?
        ORDER BY r.number
    ');
    $stmt->execute([$row['id']]);
    $detail['revisions'] = array_map(fn($r) => [
        'number' => (int)$r['number'],
        'author' => $r['username'],
        'createdAt' => $r['created_at'],
        'changeCounts' => changeCounts(decodeBundle($r['bundle'])['changes']),
    ], $stmt->fetchAll());

    if ($row['resolved_at'] !== null) {
        $detail['resolvedBy'] = $row['resolver_username'];
        $detail['resolvedAt'] = $row['resolved_at'];
        $detail['resolutionComment'] = $row['resolution_comment'];
    }
    if ($row['applied_result'] !== null) {
        $applied = json_decode($row['applied_result'], true);
        $applied['created'] = (object)($applied['created'] ?? []);
        $detail['appliedResult'] = $applied;
    }
    if ($row['forked_from_id'] !== null) {
        $detail['forkedFromId'] = (int)$row['forked_from_id'];
    }

    return $detail;
}

function handleList(PDO $db): void {
    $viewerId = optionalUserId();
    $query = [];
    parse_str($_SERVER['QUERY_STRING'] ?? '', $query);

    $status = is_string($query['status'] ?? null) ? $query['status'] : '';
    $mediaId = isset($query['mediaId']) && is_string($query['mediaId']) && ctype_digit($query['mediaId']) ? (int)$query['mediaId'] : null;
    $author = is_string($query['author'] ?? null) ? $query['author'] : '';
    $sort = is_string($query['sort'] ?? null) ? $query['sort'] : 'newest';
    $page = is_string($query['page'] ?? null) && ctype_digit($query['page']) ? max(1, (int)$query['page']) : 1;
    $pageSize = is_string($query['pageSize'] ?? null) && ctype_digit($query['pageSize'])
        ? min(100, max(1, (int)$query['pageSize']))
        : SUGGESTION_PAGE_SIZE;

    $where = [];
    $params = [];

    if ($status !== '') {
        $statuses = array_values(array_intersect(explode(',', $status), SUGGESTION_STATUSES));
        if ($statuses === []) {
            errorResponse('Invalid status filter', 400);
        }
        $where[] = 's.status IN (' . implode(',', array_fill(0, count($statuses), '?')) . ')';
        $params = array_merge($params, $statuses);
    }

    if ($mediaId !== null) {
        $where[] = 's.media_id = ?';
        $params[] = $mediaId;
    }

    if ($author !== '') {
        if ($author === 'me') {
            if ($viewerId === null) {
                successResponse(['suggestions' => [], 'total' => 0, 'page' => $page, 'pageSize' => $pageSize, 'totalPages' => 0]);
            }
            $where[] = 's.author_id = ?';
            $params[] = $viewerId;
        } else {
            $where[] = 'u.username = ? COLLATE NOCASE';
            $params[] = $author;
        }
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $orderBy = match ($sort) {
        'votes' => 'vote_count DESC, s.updated_at DESC',
        'updated' => 's.updated_at DESC',
        default => 's.created_at DESC',
    };

    $countStmt = $db->prepare("SELECT COUNT(*) FROM suggestions s JOIN users u ON u.id = s.author_id $whereClause");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare(suggestionSelect() . " $whereClause ORDER BY $orderBy LIMIT ? OFFSET ?");
    $stmt->execute([$viewerId ?? 0, ...$params, $pageSize, ($page - 1) * $pageSize]);

    $suggestions = [];
    foreach ($stmt->fetchAll() as $row) {
        $bundle = decodeBundle($row['rev_bundle']);
        $suggestions[] = formatSummary($row, $bundle, computeStale($db, $row, $bundle));
    }

    successResponse([
        'suggestions' => $suggestions,
        'total' => $total,
        'page' => $page,
        'pageSize' => $pageSize,
        'totalPages' => (int)ceil($total / $pageSize),
    ]);
}

function handleDetail(PDO $db, int $id): void {
    successResponse(formatDetail($db, loadSuggestionRow($db, $id, optionalUserId())));
}

function handleMediaSuggestions(PDO $db, int $mediaId): void {
    $viewerId = optionalUserId();

    $stmt = $db->prepare(suggestionSelect() . " WHERE s.media_id = ? AND s.status = 'open' ORDER BY s.updated_at DESC");
    $stmt->execute([$viewerId ?? 0, $mediaId]);

    $open = [];
    $mine = null;
    foreach ($stmt->fetchAll() as $row) {
        $bundle = decodeBundle($row['rev_bundle']);
        $summary = formatSummary($row, $bundle, computeStale($db, $row, $bundle));
        $open[] = $summary;
        if ($viewerId !== null && (int)$row['author_id'] === $viewerId) {
            $mine = $summary;
        }
    }

    successResponse(['open' => $open, 'mine' => $mine]);
}

function handleGetRevision(PDO $db, int $id, int $number): void {
    $stmt = $db->prepare('
        SELECT r.number, r.description, r.bundle, r.created_at, u.username
        FROM suggestion_revisions r
        JOIN users u ON u.id = r.author_id
        WHERE r.suggestion_id = ? AND r.number = ?
    ');
    $stmt->execute([$id, $number]);
    $row = $stmt->fetch();
    if (!$row) {
        errorResponse('Revision nicht gefunden', 404);
    }

    successResponse([
        'number' => (int)$row['number'],
        'author' => $row['username'],
        'createdAt' => $row['created_at'],
        'description' => $row['description'],
        'bundle' => decodeBundle($row['bundle']),
    ]);
}

function validateProposedMedia(array $input): array {
    $name = trim($input['name'] ?? '');
    if ($name === '') {
        errorResponse('proposedMedia.name is required', 400);
    }
    validateMediaInput($input, 'proposedMedia: ');

    return [
        'name' => $name,
        'type' => $input['type'],
        'tvdbId' => $input['tvdbId'] ?? null,
        'imdbId' => $input['imdbId'] ?? null,
        'tmdbId' => $input['tmdbId'] ?? null,
    ];
}

function validateDescription(mixed $description): string {
    if (!is_string($description) || mb_strlen(trim($description)) < 10) {
        errorResponse('Begründung muss mindestens 10 Zeichen lang sein', 400);
    }
    return trim($description);
}

function normaliseBundle(PDO $db, array $input, ?int $mediaId): array {
    if (!is_array($input['changes'] ?? null) || !array_is_list($input['changes']) || $input['changes'] === []) {
        errorResponse('bundle.changes must be a non-empty array', 400);
    }

    $changes = [];
    $keys = [];
    $rulesetKeys = [];
    $stale = [];

    foreach ($input['changes'] as $i => $change) {
        if (!is_array($change)) {
            errorResponse("bundle.changes[$i] must be an object", 400);
        }
        $key = $change['key'] ?? null;
        if (!is_string($key) || trim($key) === '') {
            errorResponse("bundle.changes[$i].key is required", 400);
        }
        if (in_array($key, $keys, true)) {
            errorResponse("Duplicate change key '$key'", 400);
        }
        $keys[] = $key;

        $op = $change['op'] ?? null;
        if (!in_array($op, ['create', 'update', 'delete'], true)) {
            errorResponse("$key: op must be create, update or delete", 400);
        }
        if ($op !== 'create' && $mediaId === null) {
            errorResponse("$key: nur neue Rulesets sind für vorgeschlagene Media möglich", 400);
        }

        $normalised = ['key' => $key, 'op' => $op];

        if ($op === 'update' || $op === 'delete') {
            $rulesetId = $change['rulesetId'] ?? null;
            if (!is_int($rulesetId)) {
                errorResponse("$key: rulesetId is required", 400);
            }
            if (isset($rulesetKeys[$rulesetId])) {
                errorResponse("$key: Ruleset #$rulesetId wird bereits von Änderung '{$rulesetKeys[$rulesetId]}' verändert", 400);
            }
            $rulesetKeys[$rulesetId] = $key;
            $live = liveRuleset($db, $rulesetId);
            if (!$live || (int)$live['mediaId'] !== $mediaId) {
                $stale[] = ['key' => $key, 'reason' => 'ruleset_missing'];
                continue;
            }
            $liveJson = formatRuleset($live);
            unset($liveJson['media']);

            $baseRuleset = $change['base']['ruleset'] ?? null;
            if (!is_array($baseRuleset)) {
                errorResponse("$key: base.ruleset is required", 400);
            }
            $liveHash = rulesetHash($liveJson);
            if (rulesetHash($baseRuleset) !== $liveHash) {
                $stale[] = ['key' => $key, 'reason' => 'ruleset_changed'];
                continue;
            }

            $normalised['rulesetId'] = $rulesetId;
            $normalised['base'] = ['hash' => $liveHash, 'ruleset' => $liveJson];
        }

        if ($op === 'create' || $op === 'update') {
            $ruleset = $change['ruleset'] ?? null;
            if (!is_array($ruleset)) {
                errorResponse("$key: ruleset is required", 400);
            }
            foreach (['topic', 'matchingStrategy'] as $required) {
                if (!isset($ruleset[$required]) || $ruleset[$required] === '') {
                    errorResponse("$key: $required is required", 400);
                }
            }
            validateRulesetInput($db, $ruleset, "$key: ");
            $normalised['ruleset'] = rulesetBody($ruleset);
        }

        $snapshot = $change['snapshot'] ?? null;
        if ($snapshot !== null && !is_array($snapshot)) {
            errorResponse("$key: snapshot must be an object or null", 400);
        }
        if (is_array($snapshot['samples'] ?? null) && count($snapshot['samples']) > 8) {
            errorResponse("$key: snapshot.samples darf höchstens 8 Einträge enthalten", 400);
        }
        $normalised['snapshot'] = $snapshot;

        $changes[] = $normalised;
    }

    if ($stale !== []) {
        jsonResponse([
            'success' => false,
            'error' => 'Der Vorschlag basiert auf veralteten Rulesets',
            'stale' => $stale,
        ], 409);
    }

    $order = $input['order'] ?? null;
    if ($order !== null) {
        if (!is_array($order) || !array_is_list($order)) {
            errorResponse('bundle.order must be an array of refs or null', 400);
        }
        $createKeys = array_column(array_filter($changes, fn($c) => $c['op'] === 'create'), 'key');
        $seen = [];
        foreach ($order as $ref) {
            if (!is_string($ref)) {
                errorResponse('bundle.order refs must be strings', 400);
            }
            if (in_array($ref, $seen, true)) {
                errorResponse("Duplicate order ref '$ref'", 400);
            }
            $seen[] = $ref;
            if (in_array($ref, $createKeys, true)) {
                continue;
            }
            $live = ctype_digit($ref) ? liveRuleset($db, (int)$ref) : null;
            if (!$live || ($live['mediaId'] === null ? null : (int)$live['mediaId']) !== $mediaId) {
                errorResponse("Unknown order ref '$ref'", 400);
            }
        }
    }

    $coverage = $input['coverage'] ?? null;
    if ($coverage !== null && !is_array($coverage)) {
        errorResponse('bundle.coverage must be an object or null', 400);
    }

    $bundle = ['changes' => $changes, 'order' => $order, 'coverage' => $coverage];
    if (strlen(json_encode($bundle, JSON_UNESCAPED_UNICODE)) > 262144) {
        errorResponse('Der Vorschlag ist zu groß (max. 256 KB)', 400);
    }

    return $bundle;
}

function assertNoOpenProposal(PDO $db, int $authorId, ?int $mediaId, ?array $proposedMedia, ?int $exceptId = null): void {
    if ($mediaId !== null) {
        $sql = "SELECT id FROM suggestions WHERE author_id = ? AND media_id = ? AND status = 'open'";
        $params = [$authorId, $mediaId];
        if ($exceptId !== null) {
            $sql .= ' AND id != ?';
            $params[] = $exceptId;
        }
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        if ($row = $stmt->fetch()) {
            errorResponse('Du hast bereits einen offenen Vorschlag (#' . $row['id'] . ') für dieses Media', 409);
        }
        return;
    }

    $stmt = $db->prepare("SELECT id, proposed_media FROM suggestions WHERE author_id = ? AND media_id IS NULL AND status = 'open'");
    $stmt->execute([$authorId]);
    foreach ($stmt->fetchAll() as $row) {
        if ($exceptId !== null && (int)$row['id'] === $exceptId) {
            continue;
        }
        $other = json_decode($row['proposed_media'] ?? '', true);
        if (is_array($other) && isSameMedia($proposedMedia, $other)) {
            errorResponse('Du hast bereits einen offenen Vorschlag (#' . $row['id'] . ') für dieses Media', 409);
        }
    }
}

function handleCreate(PDO $db): void {
    $user = currentUser();
    $input = getJsonInput();

    $hasMediaId = isset($input['mediaId']);
    $hasProposed = isset($input['proposedMedia']);
    if ($hasMediaId === $hasProposed) {
        errorResponse('Entweder mediaId oder proposedMedia angeben', 400);
    }

    $mediaId = null;
    $proposedMedia = null;

    if ($hasMediaId) {
        if (!is_int($input['mediaId'])) {
            errorResponse('mediaId must be an integer', 400);
        }
        $mediaId = $input['mediaId'];
        $stmt = $db->prepare('SELECT id FROM media WHERE id = ?');
        $stmt->execute([$mediaId]);
        if (!$stmt->fetch()) {
            errorResponse('Media not found', 404);
        }
    } else {
        if (!is_array($input['proposedMedia'])) {
            errorResponse('proposedMedia must be an object', 400);
        }
        $proposedMedia = validateProposedMedia($input['proposedMedia']);
        $existingMediaId = findExistingMediaId($db, $proposedMedia);
        if ($existingMediaId !== null) {
            jsonResponse([
                'success' => false,
                'error' => 'Dieses Medium existiert bereits',
                'stale' => [['key' => null, 'reason' => 'media_exists']],
                'mediaId' => $existingMediaId,
            ], 409);
        }
    }

    $description = validateDescription($input['description'] ?? null);

    if (!is_array($input['bundle'] ?? null)) {
        errorResponse('bundle is required', 400);
    }
    $bundle = normaliseBundle($db, $input['bundle'], $mediaId);

    $forkedFromId = $input['forkedFromId'] ?? null;
    if ($forkedFromId !== null) {
        if (!is_int($forkedFromId)) {
            errorResponse('forkedFromId must be an integer', 400);
        }
        $stmt = $db->prepare('SELECT id FROM suggestions WHERE id = ?');
        $stmt->execute([$forkedFromId]);
        if (!$stmt->fetch()) {
            errorResponse('Vorschlag nicht gefunden', 404);
        }
    }

    assertNoOpenProposal($db, $user['id'], $mediaId, $proposedMedia);

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("
            INSERT INTO suggestions (media_id, proposed_media, author_id, status, current_revision, forked_from_id)
            VALUES (?, ?, ?, 'open', 1, ?)
        ");
        $stmt->execute([
            $mediaId,
            $proposedMedia === null ? null : json_encode($proposedMedia, JSON_UNESCAPED_UNICODE),
            $user['id'],
            $forkedFromId,
        ]);
        $id = (int)$db->lastInsertId();

        insertRevision($db, $id, 1, $user['id'], $description, $bundle);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    successResponse(formatDetail($db, loadSuggestionRow($db, $id, $user['id'])));
}

function insertRevision(PDO $db, int $suggestionId, int $number, int $authorId, string $description, array $bundle): void {
    $stmt = $db->prepare('
        INSERT INTO suggestion_revisions (suggestion_id, number, author_id, description, bundle)
        VALUES (?, ?, ?, ?, ?)
    ');
    $stmt->execute([$suggestionId, $number, $authorId, $description, json_encode($bundle, JSON_UNESCAPED_UNICODE)]);
}

function handleRevise(PDO $db, int $id): void {
    $user = currentUser();

    $stmt = $db->prepare('SELECT * FROM suggestions WHERE id = ?');
    $stmt->execute([$id]);
    $suggestion = $stmt->fetch();
    if (!$suggestion) {
        errorResponse('Vorschlag nicht gefunden', 404);
    }
    if ($suggestion['status'] !== 'open') {
        errorResponse('Nur offene Vorschläge können bearbeitet werden', 409);
    }
    if ((int)$suggestion['author_id'] !== $user['id'] && !$user['is_admin']) {
        errorResponse('Nur der Autor oder ein Admin kann diesen Vorschlag bearbeiten', 403);
    }

    $input = getJsonInput();
    if (!is_int($input['revision'] ?? null)) {
        errorResponse('revision is required', 400);
    }
    if ($input['revision'] !== (int)$suggestion['current_revision']) {
        revisionChangedResponse((int)$suggestion['current_revision']);
    }
    $description = validateDescription($input['description'] ?? null);

    $mediaId = $suggestion['media_id'] === null ? null : (int)$suggestion['media_id'];
    $proposedMedia = json_decode($suggestion['proposed_media'] ?? '', true);
    $switchToMedia = false;

    if (isset($input['mediaId'])) {
        if (!is_int($input['mediaId'])) {
            errorResponse('mediaId must be an integer', 400);
        }
        if ($mediaId !== null && $mediaId !== $input['mediaId']) {
            errorResponse('Das Media eines Vorschlags kann nicht gewechselt werden', 400);
        }
        if ($mediaId === null) {
            if (!is_array($proposedMedia)) {
                errorResponse('Das Medium dieses Vorschlags wurde gelöscht', 409);
            }
            $stmt = $db->prepare('SELECT id FROM media WHERE id = ?');
            $stmt->execute([$input['mediaId']]);
            if (!$stmt->fetch()) {
                errorResponse('Media not found', 404);
            }
            $mediaId = $input['mediaId'];
            $proposedMedia = null;
            $switchToMedia = true;
        }
    }

    if (!is_array($input['bundle'] ?? null)) {
        errorResponse('bundle is required', 400);
    }
    $bundle = normaliseBundle($db, $input['bundle'], $mediaId);

    if ($switchToMedia) {
        assertNoOpenProposal($db, (int)$suggestion['author_id'], $mediaId, null, $id);
    }

    $number = (int)$suggestion['current_revision'] + 1;

    $db->beginTransaction();
    try {
        $updated = $db->prepare("
            UPDATE suggestions
            SET current_revision = ?, media_id = ?, proposed_media = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'open' AND current_revision = ?
        ");
        $updated->execute([
            $number,
            $mediaId,
            $proposedMedia === null ? null : json_encode($proposedMedia, JSON_UNESCAPED_UNICODE),
            $id,
            $number - 1,
        ]);
        if ($updated->rowCount() !== 1) {
            $db->rollBack();
            errorResponse('Der Vorschlag wurde inzwischen geändert oder abgeschlossen. Bitte neu laden.', 409);
        }
        insertRevision($db, $id, $number, $user['id'], $description, $bundle);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    successResponse(formatDetail($db, loadSuggestionRow($db, $id, $user['id'])));
}

function loadOpenSuggestion(PDO $db, int $id, int $viewerId, string $action): array {
    $row = loadSuggestionRow($db, $id, $viewerId);
    if ($row['status'] !== 'open') {
        errorResponse("Nur offene Vorschläge können $action werden", 409);
    }
    return $row;
}

function resolveSuggestion(PDO $db, int $id, string $status, int $resolvedBy, ?string $comment): void {
    $db->prepare('
        UPDATE suggestions
        SET status = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, resolution_comment = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ')->execute([$status, $resolvedBy, $comment, $id]);
}

function handleWithdraw(PDO $db, int $id): void {
    $user = currentUser();
    $row = loadOpenSuggestion($db, $id, $user['id'], 'zurückgezogen');

    if ((int)$row['author_id'] !== $user['id']) {
        errorResponse('Nur der Autor kann einen Vorschlag zurückziehen', 403);
    }

    $comment = getJsonInput()['comment'] ?? null;
    resolveSuggestion($db, $id, 'withdrawn', $user['id'], is_string($comment) && trim($comment) !== '' ? trim($comment) : null);

    successResponse(formatDetail($db, loadSuggestionRow($db, $id, $user['id'])));
}

function handleReject(PDO $db, int $id): void {
    $userId = requireAdmin();
    loadOpenSuggestion($db, $id, $userId, 'abgelehnt');

    $comment = getJsonInput()['comment'] ?? null;
    if (!is_string($comment) || trim($comment) === '') {
        errorResponse('Eine Begründung ist beim Ablehnen erforderlich', 400);
    }

    resolveSuggestion($db, $id, 'rejected', $userId, trim($comment));

    successResponse(formatDetail($db, loadSuggestionRow($db, $id, $userId)));
}

function revisionChangedResponse(?int $currentRevision): never {
    jsonResponse([
        'success' => false,
        'error' => 'Der Vorschlag wurde inzwischen geändert. Bitte die aktuelle Revision prüfen.',
        'revisionChanged' => true,
        'currentRevision' => $currentRevision,
    ], 409);
}

function handleAccept(PDO $db, int $id): void {
    requireAdmin();
    $user = currentUser();

    $row = loadOpenSuggestion($db, $id, $user['id'], 'angenommen');
    $bundle = decodeBundle($row['rev_bundle']);
    $revision = (int)$row['current_revision'];

    $input = getJsonInput();
    if (!is_int($input['revision'] ?? null)) {
        errorResponse('revision is required', 400);
    }
    if ($input['revision'] !== $revision) {
        revisionChangedResponse($revision);
    }

    $comment = $input['comment'] ?? null;
    $comment = is_string($comment) && trim($comment) !== '' ? trim($comment) : null;

    $db->beginTransaction();
    try {
        $stale = computeStale($db, $row, $bundle);
        if ($stale !== []) {
            $db->rollBack();
            jsonResponse([
                'success' => false,
                'error' => 'Der Vorschlag ist veraltet und muss erst aktualisiert werden',
                'stale' => $stale,
            ], 409);
        }

        $mediaId = $row['media_id'] === null ? null : (int)$row['media_id'];
        $createdMediaId = null;

        if ($mediaId === null) {
            $proposed = json_decode($row['proposed_media'] ?? '', true);
            $stmt = $db->prepare('INSERT INTO media (name, type, tmdbId, imdbId, tvdbId) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([
                $proposed['name'],
                $proposed['type'],
                $proposed['tmdbId'] ?? null,
                $proposed['imdbId'] ?? null,
                $proposed['tvdbId'] ?? null,
            ]);
            $mediaId = (int)$db->lastInsertId();
            $createdMediaId = $mediaId;
        }

        $deleted = [];
        $updated = [];
        $created = [];

        foreach ($bundle['changes'] as $change) {
            if ($change['op'] !== 'delete') {
                continue;
            }
            $rulesetId = (int)$change['rulesetId'];
            $db->prepare('DELETE FROM rulesets WHERE id = ?')->execute([$rulesetId]);
            $deleted[] = $rulesetId;
        }

        foreach ($bundle['changes'] as $change) {
            if ($change['op'] !== 'update') {
                continue;
            }
            $rulesetId = (int)$change['rulesetId'];
            $body = rulesetBody($change['ruleset']);
            $db->prepare('
                UPDATE rulesets
                SET topic = ?, matchingStrategy = ?, filters = ?, titleRegexRules = ?, seasonRegex = ?, episodeRegex = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ')->execute([
                $body['topic'],
                $body['matchingStrategy'],
                json_encode($body['filters'], JSON_UNESCAPED_UNICODE),
                json_encode($body['titleRegexRules'], JSON_UNESCAPED_UNICODE),
                $body['seasonRegex'],
                $body['episodeRegex'],
                $rulesetId,
            ]);
            $updated[] = $rulesetId;
        }

        $stmt = $db->prepare('SELECT COALESCE(MAX(priority), -1) FROM rulesets WHERE mediaId = ?');
        $stmt->execute([$mediaId]);
        $nextPriority = (int)$stmt->fetchColumn() + 1;

        foreach ($bundle['changes'] as $change) {
            if ($change['op'] !== 'create') {
                continue;
            }
            $body = rulesetBody($change['ruleset']);
            $db->prepare('
                INSERT INTO rulesets (mediaId, topic, priority, filters, titleRegexRules, episodeRegex, seasonRegex, matchingStrategy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ')->execute([
                $mediaId,
                $body['topic'],
                $nextPriority++,
                json_encode($body['filters'], JSON_UNESCAPED_UNICODE),
                json_encode($body['titleRegexRules'], JSON_UNESCAPED_UNICODE),
                $body['episodeRegex'],
                $body['seasonRegex'],
                $body['matchingStrategy'],
            ]);
            $created[$change['key']] = (int)$db->lastInsertId();
        }

        $stmt = $db->prepare('SELECT id, priority FROM rulesets WHERE mediaId = ? ORDER BY priority, id');
        $stmt->execute([$mediaId]);
        $livePriorities = [];
        foreach ($stmt->fetchAll() as $liveRow) {
            $livePriorities[(int)$liveRow['id']] = (int)$liveRow['priority'];
        }

        $finalOrder = [];
        foreach ($bundle['order'] ?? [] as $ref) {
            if (isset($created[$ref])) {
                $finalOrder[] = $created[$ref];
            } elseif (is_numeric($ref) && isset($livePriorities[(int)$ref])) {
                $finalOrder[] = (int)$ref;
            }
        }
        foreach (array_keys($livePriorities) as $liveId) {
            if (!in_array($liveId, $finalOrder, true)) {
                $finalOrder[] = $liveId;
            }
        }

        $update = $db->prepare('UPDATE rulesets SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        foreach ($finalOrder as $position => $rulesetId) {
            $update->execute([$position, $rulesetId]);
        }

        $db->prepare('UPDATE suggestions SET media_id = ?, applied_result = ? WHERE id = ?')->execute([
            $mediaId,
            json_encode([
                'mediaId' => $mediaId,
                'createdMediaId' => $createdMediaId,
                'created' => (object)$created,
                'updated' => $updated,
                'deleted' => $deleted,
                'order' => $finalOrder,
            ], JSON_UNESCAPED_UNICODE),
            $id,
        ]);
        $resolved = $db->prepare("
            UPDATE suggestions
            SET status = 'accepted', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, resolution_comment = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'open' AND current_revision = ?
        ");
        $resolved->execute([$user['id'], $comment, $id, $revision]);
        if ($resolved->rowCount() !== 1) {
            $db->rollBack();
            revisionChangedResponse(null);
        }

        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

    successResponse(formatDetail($db, loadSuggestionRow($db, $id, $user['id'])));
}

function handleVote(PDO $db, int $id, bool $voted): void {
    $user = currentUser();

    $stmt = $db->prepare('SELECT id FROM suggestions WHERE id = ?');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        errorResponse('Vorschlag nicht gefunden', 404);
    }

    if ($voted) {
        $db->prepare('INSERT OR IGNORE INTO suggestion_votes (suggestion_id, user_id) VALUES (?, ?)')
            ->execute([$id, $user['id']]);
    } else {
        $db->prepare('DELETE FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?')
            ->execute([$id, $user['id']]);
    }

    $stmt = $db->prepare('SELECT COUNT(*) FROM suggestion_votes WHERE suggestion_id = ?');
    $stmt->execute([$id]);

    successResponse(['votes' => (int)$stmt->fetchColumn(), 'hasVoted' => $voted]);
}

function formatComment(array $row): array {
    $deleted = $row['deleted_at'] !== null;
    return [
        'id' => (int)$row['id'],
        'author' => ['id' => (int)$row['user_id'], 'username' => $row['username']],
        'content' => $deleted ? null : $row['content'],
        'createdAt' => $row['created_at'],
        'editedAt' => $row['edited_at'],
        'deleted' => $deleted,
    ];
}

function handleListComments(PDO $db, int $id): void {
    $stmt = $db->prepare('
        SELECT c.*, u.username
        FROM suggestion_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.suggestion_id = ?
        ORDER BY c.created_at, c.id
    ');
    $stmt->execute([$id]);
    successResponse(array_map('formatComment', $stmt->fetchAll()));
}

function validateCommentContent(mixed $content): string {
    if (!is_string($content) || trim($content) === '') {
        errorResponse('Kommentar darf nicht leer sein', 400);
    }
    if (mb_strlen($content) > 5000) {
        errorResponse('Kommentar ist zu lang (max. 5000 Zeichen)', 400);
    }
    return trim($content);
}

function loadComment(PDO $db, int $suggestionId, int $commentId): array {
    $stmt = $db->prepare('
        SELECT c.*, u.username
        FROM suggestion_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.id = ? AND c.suggestion_id = ?
    ');
    $stmt->execute([$commentId, $suggestionId]);
    $row = $stmt->fetch();
    if (!$row) {
        errorResponse('Kommentar nicht gefunden', 404);
    }
    return $row;
}

function handleAddComment(PDO $db, int $id): void {
    $user = currentUser();
    $content = validateCommentContent(getJsonInput()['content'] ?? null);

    $stmt = $db->prepare('SELECT id FROM suggestions WHERE id = ?');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        errorResponse('Vorschlag nicht gefunden', 404);
    }

    $db->prepare('INSERT INTO suggestion_comments (suggestion_id, user_id, content) VALUES (?, ?, ?)')
        ->execute([$id, $user['id'], $content]);

    successResponse(formatComment(loadComment($db, $id, (int)$db->lastInsertId())));
}

function handleEditComment(PDO $db, int $id, int $commentId): void {
    $user = currentUser();
    $comment = loadComment($db, $id, $commentId);

    if ((int)$comment['user_id'] !== $user['id']) {
        errorResponse('Nur eigene Kommentare können bearbeitet werden', 403);
    }
    if ($comment['deleted_at'] !== null) {
        errorResponse('Kommentar wurde entfernt', 409);
    }

    $content = validateCommentContent(getJsonInput()['content'] ?? null);
    $db->prepare('UPDATE suggestion_comments SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?')
        ->execute([$content, $commentId]);

    successResponse(formatComment(loadComment($db, $id, $commentId)));
}

function handleDeleteComment(PDO $db, int $id, int $commentId): void {
    $user = currentUser();
    $comment = loadComment($db, $id, $commentId);

    if ((int)$comment['user_id'] !== $user['id'] && !$user['is_admin']) {
        errorResponse('Nur eigene Kommentare können gelöscht werden', 403);
    }
    if ($comment['deleted_at'] === null) {
        $db->prepare('UPDATE suggestion_comments SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?')
            ->execute([$user['id'], $commentId]);
    }

    successResponse(formatComment(loadComment($db, $id, $commentId)));
}
