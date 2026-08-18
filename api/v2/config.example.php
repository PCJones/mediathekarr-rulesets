<?php

/*
|--------------------------------------------------------------------------
| JWT SECRET - CHANGE THIS BEFORE DEPLOYING!
|--------------------------------------------------------------------------
*/
define('JWT_SECRET', 'replace-with-your-own-NqlxRWA0A2FeSVMw');

$allowedOrigins = [
    'https://mediathekarr-rulesets.vercel.app',
    'http://localhost:5173',
];

// The default lives inside the webroot and relies on database/.htaccess (Apache + AllowOverride).
// On any other server, point this outside the webroot or the whole DB is downloadable.
define('DB_PATH', __DIR__ . '/database/database.sqlite');

/*
|--------------------------------------------------------------------------
| GitHub OAuth (optional) - leave empty to disable "Login mit GitHub"
| Create an OAuth app at https://github.com/settings/developers with
| callback URL: <frontend-url>/auth/github/callback
|--------------------------------------------------------------------------
*/
define('GITHUB_CLIENT_ID', '');
define('GITHUB_CLIENT_SECRET', '');


$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
}

header("Access-Control-Allow-Methods: GET, OPTIONS, PATCH, DELETE, POST, PUT");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (JWT_SECRET === 'replace-with-your-own-NqlxRWA0A2FeSVMw' || strlen(JWT_SECRET) < 32) {
    errorResponse('JWT_SECRET is not configured. Set a random secret of at least 32 characters in config.php.', 500);
}

set_exception_handler(function (Throwable $e): void {
    error_log($e);
    errorResponse('Internal server error', 500);
});

function getDatabase(): PDO {
    static $db = null;
    if ($db === null) {
        $db = new PDO('sqlite:' . DB_PATH);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $db->exec('PRAGMA foreign_keys = ON');
    }
    return $db;
}

function jsonResponse(mixed $data, int $statusCode = 200): never {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function errorResponse(string $message, int $statusCode = 400): never {
    jsonResponse([
        'success' => false,
        'error' => $message
    ], $statusCode);
}

function successResponse(mixed $data = null, ?string $message = null): never {
    $response = ['success' => true];
    if ($data !== null) {
        $response['data'] = $data;
    }
    if ($message !== null) {
        $response['message'] = $message;
    }
    jsonResponse($response);
}

function getJsonInput(): array {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        errorResponse('Invalid JSON input', 400);
    }
    if ($data !== null && !is_array($data)) {
        errorResponse('JSON body must be an object or array', 400);
    }
    return $data ?? [];
}

function validateRequired(array $data, array $fields): void {
    foreach ($fields as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            errorResponse("Field '$field' is required", 400);
        }
    }
}

function validateRegex(string $pattern, string $fieldName): void {
    if (@preg_match("\x01" . $pattern . "\x01", '') === false) {
        $detail = preg_replace('/^preg_match\(\): (Compilation failed: )?/', '', error_get_last()['message'] ?? 'invalid pattern');
        errorResponse("Invalid regex in '$fieldName': $detail", 400);
    }
}
?>
