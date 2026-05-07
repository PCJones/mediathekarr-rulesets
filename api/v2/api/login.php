<?php

require_once __DIR__ . '/../config.php';

$db = getDatabase();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    validateRequired($input, ['email', 'password']);

    $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$input['email']]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($input['password'], $user['password'])) {
        errorResponse('Invalid credentials', 401);
    }

    $header = rtrim(strtr(base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'])), '+/', '-_'), '=');
    $payload = rtrim(strtr(base64_encode(json_encode([
        'userId' => $user['id'],
        'email' => $user['email'],
        'role' => $user['is_admin'] ? 'admin' : 'user',
        'exp' => time() + (7 * 24 * 60 * 60)
    ])), '+/', '-_'), '=');
    $signature = rtrim(strtr(base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)), '+/', '-_'), '=');

    successResponse(['token' => "$header.$payload.$signature"]);
} else {
    errorResponse('Method not allowed', 405);
}
