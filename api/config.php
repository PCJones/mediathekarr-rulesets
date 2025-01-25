<?php
header("Access-Control-Allow-Origin: https://jones-sanity.vercel.app");
header("Access-Control-Allow-Methods: GET, OPTIONS, PATCH, DELETE, POST, PUT");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

define('DB_PATH', __DIR__ . '/database/database.sqlite');
define('JWT_SECRET', '387a3c28c01301d25c865c7677060095e784c6786018d815e85417fdf4de711f7ac065f61e930d6fa3c757536c7e3a66186d943816769feed68206a11d9037fc4329fddbcedfd412f43233df72a7f554dbd761719d958491c339582d869dab5cc73bc38709dee1665a8d194caba846c0717a349e243def12527878e4aedb253f5ca59953c460b2ff9feb0d4aedf341e51b1501d8098d134cbc301dbb691c29558491e50cbca1731005d0f346e288428f5a5c496e8f53b29144aa2c3c6ab381f5052618cb5bb8f0acfe5503ff924cff286975d570cf2e7d7f3300036f358b1aeccd83f2a19ec3e1a2631cd694eb7ed3734fe6c0ff819e29bebdd3f6485bffe442'); // Replace with a secure secret
?>