<?php

function generateJWT($userId) {
    $header = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64_encode(json_encode(['user_id' => $userId, 'iat' => time()]));
    $signature = hash_hmac('sha256', "$header.$payload", JWT_SECRET, true);
    return "$header.$payload." . base64_encode($signature);
}

function validateJWT($token) {
    [$header, $payload, $signature] = explode('.', $token);
    $validSignature = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if ($signature !== $validSignature) {
        return false;
    }
    $payloadData = json_decode(base64_decode($payload), true);
    return $payloadData['user_id'] ?? false;
}
?>