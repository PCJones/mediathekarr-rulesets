<?php

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

$db = getDatabase();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Method not allowed', 405);
}

$pathParts = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
$rulesetId = $pathParts[0] ?? null;

if (!$rulesetId || !is_numeric($rulesetId)) {
    errorResponse('Ruleset ID required', 400);
}

$stmt = $db->prepare('SELECT id FROM rulesets WHERE id = ?');
$stmt->execute([$rulesetId]);
if (!$stmt->fetch()) {
    errorResponse('Ruleset not found', 404);
}

$stmt = $db->prepare('
    SELECT *
    FROM ruleset_changelog
    WHERE ruleset_id = ?
    ORDER BY changed_at DESC
    LIMIT 100
');
$stmt->execute([$rulesetId]);
$entries = $stmt->fetchAll();

successResponse(array_map(function ($entry) {
    return [
        'id' => (int)$entry['id'],
        'rulesetId' => (int)$entry['ruleset_id'],
        'changedBy' => $entry['changed_by'],
        'changedAt' => $entry['changed_at'],
        'changeSummary' => $entry['change_summary']
    ];
}, $entries));
?>
