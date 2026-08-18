<?php

require_once __DIR__ . '/../config.php';

$db = getDatabase();
$method = $_SERVER['REQUEST_METHOD'];
$path = trim($_SERVER['PATH_INFO'] ?? '', '/');

function base64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function issueToken(array $user): never {
    $header = base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64url(json_encode([
        'userId' => $user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['is_admin'] ? 'admin' : 'user',
        'exp' => time() + (7 * 24 * 60 * 60)
    ]));
    $signature = base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    successResponse(['token' => "$header.$payload.$signature"]);
}

function validateUsername(string $username): void {
    if (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', $username)) {
        errorResponse('Username must be 3-30 characters (letters, digits, _ . -)', 400);
    }
}

function findUserBy(PDO $db, string $column, string $value): ?array {
    $stmt = $db->prepare("SELECT * FROM users WHERE $column = ? COLLATE NOCASE");
    $stmt->execute([$value]);
    return $stmt->fetch() ?: null;
}

function githubRequest(string $url, ?array $post = null, ?string $token = null): ?array {
    $headers = ['Accept: application/json', 'User-Agent: MediathekArr-Rulesets'];
    if ($token) {
        $headers[] = "Authorization: Bearer $token";
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 15,
    ]);
    if ($post !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post));
    }
    $body = curl_exec($ch);
    curl_close($ch);
    if ($body === false) {
        return null;
    }
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

function uniqueUsername(PDO $db, string $base): string {
    $base = preg_replace('/[^A-Za-z0-9_.-]/', '', $base);
    if (strlen($base) < 3) {
        $base = 'user' . $base;
    }
    $base = substr($base, 0, 26);
    $candidate = $base;
    $i = 1;
    while (findUserBy($db, 'username', $candidate)) {
        $candidate = $base . '-' . (++$i);
    }
    return $candidate;
}

// POST /auth  - login with email or username + password
if ($path === '' && $method === 'POST') {
    $input = getJsonInput();
    validateRequired($input, ['password']);
    $identifier = trim($input['identifier'] ?? $input['email'] ?? $input['username'] ?? '');
    if ($identifier === '') {
        errorResponse("Field 'identifier' is required", 400);
    }

    $user = findUserBy($db, str_contains($identifier, '@') ? 'email' : 'username', $identifier);

    if (!$user || $user['password'] === '' || !password_verify($input['password'], $user['password'])) {
        errorResponse('Invalid credentials', 401);
    }

    issueToken($user);
}

// POST /auth/register
if ($path === 'register' && $method === 'POST') {
    $input = getJsonInput();
    validateRequired($input, ['username', 'email', 'password']);
    $username = trim($input['username']);
    $email = trim($input['email']);

    validateUsername($username);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        errorResponse('Invalid email address', 400);
    }
    if (strlen($input['password']) < 8) {
        errorResponse('Password must be at least 8 characters', 400);
    }
    if (findUserBy($db, 'email', $email)) {
        errorResponse('Email is already registered', 409);
    }
    if (findUserBy($db, 'username', $username)) {
        errorResponse('Username is already taken', 409);
    }

    $stmt = $db->prepare('INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, 0)');
    $stmt->execute([$username, $email, password_hash($input['password'], PASSWORD_BCRYPT)]);

    issueToken(findUserBy($db, 'email', $email));
}

// GET /auth/github - OAuth client config for the frontend
if ($path === 'github' && $method === 'GET') {
    successResponse([
        'enabled' => GITHUB_CLIENT_ID !== '' && GITHUB_CLIENT_SECRET !== '',
        'clientId' => GITHUB_CLIENT_ID,
    ]);
}

// POST /auth/github - exchange OAuth code for a JWT
if ($path === 'github' && $method === 'POST') {
    if (GITHUB_CLIENT_ID === '' || GITHUB_CLIENT_SECRET === '') {
        errorResponse('GitHub login is not configured', 404);
    }
    $input = getJsonInput();
    validateRequired($input, ['code', 'redirectUri']);

    $tokenData = githubRequest('https://github.com/login/oauth/access_token', [
        'client_id' => GITHUB_CLIENT_ID,
        'client_secret' => GITHUB_CLIENT_SECRET,
        'code' => $input['code'],
        'redirect_uri' => $input['redirectUri'],
    ]);
    if (empty($tokenData['access_token'])) {
        errorResponse('GitHub authorization failed: ' . ($tokenData['error_description'] ?? 'no access token'), 401);
    }
    $ghToken = $tokenData['access_token'];

    $ghUser = githubRequest('https://api.github.com/user', null, $ghToken);
    if (empty($ghUser['id'])) {
        errorResponse('Could not load GitHub profile', 502);
    }

    $email = $ghUser['email'] ?? null;
    if (!$email) {
        $emails = githubRequest('https://api.github.com/user/emails', null, $ghToken) ?? [];
        foreach ($emails as $e) {
            if (!empty($e['primary']) && !empty($e['verified'])) {
                $email = $e['email'];
                break;
            }
        }
        if (!$email) {
            foreach ($emails as $e) {
                if (!empty($e['verified'])) {
                    $email = $e['email'];
                    break;
                }
            }
        }
    }
    if (!$email) {
        errorResponse('Your GitHub account has no verified email address', 400);
    }

    $githubId = (string)$ghUser['id'];
    $user = findUserBy($db, 'github_id', $githubId);

    if (!$user) {
        $user = findUserBy($db, 'email', $email);
        if ($user) {
            $db->prepare('UPDATE users SET github_id = ? WHERE id = ?')->execute([$githubId, $user['id']]);
        } else {
            $username = uniqueUsername($db, $ghUser['login'] ?? 'github');
            $db->prepare('INSERT INTO users (username, email, password, github_id, is_admin) VALUES (?, ?, ?, ?, 0)')
                ->execute([$username, $email, '', $githubId]);
        }
        $user = findUserBy($db, 'github_id', $githubId);
    }

    issueToken($user);
}

errorResponse('Not found', 404);
