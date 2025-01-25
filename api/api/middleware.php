<?php
require_once '../config.php';
require_once '../utils/helpers.php';

function authenticate() {
    $headers = getallheaders();
    if (!isset($headers['Authorization'])) {
        http_response_code(408);
        die(json_encode(['error' => 'Unauthorized']));
    }

    $token = str_replace('Bearer ', '', $headers['Authorization']);
    $userId = validateJWT($token);

    if (!$userId) {
        http_response_code(401);
        die(json_encode(['error' => 'Invalid token']));
    }

    return $userId;
}
?>