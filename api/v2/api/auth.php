<?php

require_once __DIR__ . '/../config.php';

function getAuthHeader(): ?string {
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return trim($_SERVER['HTTP_AUTHORIZATION']);
    }
    if (isset($_SERVER['Authorization'])) {
        return trim($_SERVER['Authorization']);
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $key => $value) {
            if (strtolower($key) === 'authorization') {
                return trim($value);
            }
        }
    }
    return null;
}

function validateJWT(string $token): ?int {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$header, $payload, $signature] = $parts;

    $expectedSignature = base64_encode(
        hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
    );

    $expectedSignature = strtr($expectedSignature, '+/', '-_');
    $expectedSignature = rtrim($expectedSignature, '=');
    $signature = rtrim($signature, '=');

    if (!hash_equals($expectedSignature, $signature)) {
        return null;
    }

    $payloadData = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
    if (!$payloadData) {
        return null;
    }

    if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
        return null;
    }

    return $payloadData['userId'] ?? null;
}

function authenticate(): int {
    $authHeader = getAuthHeader();

    if (!$authHeader) {
        errorResponse('Bitte zuerst anmelden.', 401);
    }

    if (!preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
        errorResponse('Deine Anmeldung ist ungültig. Bitte erneut anmelden.', 401);
    }

    $userId = validateJWT($matches[1]);

    if (!$userId) {
        errorResponse('Deine Sitzung ist abgelaufen. Bitte erneut anmelden.', 401);
    }

    return $userId;
}

function optionalUserId(): ?int {
    $authHeader = getAuthHeader();
    if (!$authHeader || !preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
        return null;
    }
    return validateJWT($matches[1]) ?: null;
}

function currentUser(): array {
    $userId = authenticate();

    $db = getDatabase();
    $stmt = $db->prepare('SELECT id, email, username, is_admin FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        errorResponse('Deine Sitzung ist abgelaufen. Bitte erneut anmelden.', 401);
    }

    return [
        'id' => (int)$user['id'],
        'email' => $user['email'],
        'username' => $user['username'],
        'is_admin' => (bool)$user['is_admin'],
    ];
}

function requireAdmin(): int {
    $user = currentUser();

    if (!$user['is_admin']) {
        errorResponse('Diese Aktion ist nur für Admins möglich.', 403);
    }

    return $user['id'];
}
?>
