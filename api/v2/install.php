<?php

if (!file_exists(__DIR__ . '/config.php')) {
    http_response_code(500);
    die('config.php not found. Copy config.example.php to config.php and set your JWT_SECRET.');
}

require_once __DIR__ . '/config.php';

$dbDir = dirname(DB_PATH);
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

if (file_exists(DB_PATH)) {
    echo '<p>Already installed. <a href="/">Go to app</a></p>';
    exit;
}

$lockFile = __DIR__ . '/database/.installed';
if (file_exists($lockFile)) {
    http_response_code(403);
    die('Installation is locked: database/.installed exists but the database file is missing. Restore the database or remove the lock file to reinstall.');
}

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';

    if (empty($username) || empty($email) || empty($password)) {
        $error = 'Username, email and password are required.';
    } elseif ($password !== $confirmPassword) {
        $error = 'Passwords do not match.';
    } elseif (strlen($password) < 8) {
        $error = 'Password must be at least 8 characters.';
    } else {
        try {
            $db = new PDO('sqlite:' . DB_PATH);
            $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $db->exec('PRAGMA foreign_keys = ON');

            $db->exec("
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    github_id TEXT,
                    is_admin INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                CREATE UNIQUE INDEX idx_users_username ON users(username COLLATE NOCASE);
                CREATE UNIQUE INDEX idx_users_github_id ON users(github_id);

                CREATE TABLE media (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL CHECK(type IN ('movie', 'show')),
                    tmdbId INTEGER,
                    imdbId TEXT,
                    tvdbId INTEGER,
                    UNIQUE(name, type)
                );

                CREATE TABLE rulesets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mediaId INTEGER,
                    topic TEXT NOT NULL,
                    priority INTEGER NOT NULL DEFAULT 0,
                    filters TEXT NOT NULL DEFAULT '[]',
                    titleRegexRules TEXT DEFAULT '[]',
                    episodeRegex TEXT,
                    seasonRegex TEXT,
                    matchingStrategy TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(mediaId) REFERENCES media(id) ON DELETE CASCADE
                );

                CREATE TABLE ruleset_changelog (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ruleset_id INTEGER,
                    changed_by TEXT NOT NULL,
                    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    change_summary TEXT NOT NULL,
                    suggestion_id INTEGER,
                    applied_by TEXT,
                    FOREIGN KEY (ruleset_id) REFERENCES rulesets(id) ON DELETE SET NULL
                );

                CREATE INDEX idx_rulesets_mediaId ON rulesets(mediaId);
                CREATE INDEX idx_rulesets_priority ON rulesets(priority);
                CREATE INDEX idx_ruleset_changelog_ruleset_id ON ruleset_changelog(ruleset_id);

                CREATE TABLE suggestions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    media_id INTEGER,
                    proposed_media TEXT,
                    author_id INTEGER NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('open', 'accepted', 'rejected', 'withdrawn')),
                    current_revision INTEGER NOT NULL DEFAULT 1,
                    forked_from_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    resolved_by INTEGER,
                    resolved_at DATETIME,
                    resolution_comment TEXT,
                    applied_result TEXT,
                    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE SET NULL,
                    FOREIGN KEY (author_id) REFERENCES users(id),
                    FOREIGN KEY (forked_from_id) REFERENCES suggestions(id) ON DELETE SET NULL
                );

                CREATE UNIQUE INDEX idx_suggestions_open_per_media
                    ON suggestions(author_id, media_id) WHERE status = 'open' AND media_id IS NOT NULL;
                CREATE INDEX idx_suggestions_status ON suggestions(status, updated_at);

                CREATE TABLE suggestion_revisions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    suggestion_id INTEGER NOT NULL,
                    number INTEGER NOT NULL,
                    author_id INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    bundle TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(suggestion_id, number),
                    FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE CASCADE,
                    FOREIGN KEY (author_id) REFERENCES users(id)
                );

                CREATE TABLE suggestion_votes (
                    suggestion_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (suggestion_id, user_id),
                    FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE suggestion_comments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    suggestion_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    edited_at DATETIME,
                    deleted_at DATETIME,
                    deleted_by INTEGER,
                    FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE INDEX idx_suggestion_comments_suggestion_id ON suggestion_comments(suggestion_id);
            ");

            // Create admin user
            $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $db->prepare("INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, 1)");
            $stmt->execute([$username, $email, $hashedPassword]);

            file_put_contents($lockFile, date('c'));

            echo '<p>Setup complete! <a href="/">Go to app</a></p>';
            exit;

        } catch (Exception $e) {
            // Clean up failed DB
            if (file_exists(DB_PATH)) {
                unlink(DB_PATH);
            }
            $error = 'Setup failed: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup</title>
</head>
<body>
    <h1>Setup Admin Account</h1>
    <?php if ($error): ?>
        <p style="color: red;"><?php echo htmlspecialchars($error); ?></p>
    <?php endif; ?>
    <form method="post">
        <label for="username">Admin Username:</label><br>
        <input type="text" id="username" name="username" required value="<?php echo htmlspecialchars($_POST['username'] ?? ''); ?>"><br><br>

        <label for="email">Admin Email:</label><br>
        <input type="email" id="email" name="email" required value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>"><br><br>

        <label for="password">Password:</label><br>
        <input type="password" id="password" name="password" required minlength="8"><br><br>

        <label for="confirm_password">Confirm Password:</label><br>
        <input type="password" id="confirm_password" name="confirm_password" required><br><br>

        <button type="submit">Create Admin Account</button>
    </form>
</body>
</html>
