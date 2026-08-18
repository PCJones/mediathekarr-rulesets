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
                    FOREIGN KEY (ruleset_id) REFERENCES rulesets(id) ON DELETE SET NULL
                );

                CREATE INDEX idx_rulesets_mediaId ON rulesets(mediaId);
                CREATE INDEX idx_rulesets_priority ON rulesets(priority);
                CREATE INDEX idx_ruleset_changelog_ruleset_id ON ruleset_changelog(ruleset_id);

                CREATE TABLE predefined_title_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    pattern TEXT NOT NULL,
                    description TEXT,
                    sort_order INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1
                );

                CREATE TABLE predefined_season_episode_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    season_pattern TEXT,
                    episode_pattern TEXT,
                    description TEXT,
                    sort_order INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1
                );
            ");

            // Create admin user
            $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $db->prepare("INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, 1)");
            $stmt->execute([$username, $email, $hashedPassword]);

            // Insert default patterns
            $titlePatterns = [
                ['Default', '(.*)', 'Alles extrahieren', 0],
                ['Folge X: Titel (S01/E01)', '^(?:Folge \\d+: )(.+?)(?: \\(\\S+\\))?$', 'Format: Folge 1: Titel (S01/E01)', 1],
                ['Folge X: Titel', '^Folge \\d+: (.+)$', 'Format: Folge 1: Titel', 2],
                ['Titel (S01/E01)', '^(.+?) \\(\\S+\\)$', 'Format: Titel (S01/E01)', 3],
                ['Nach Doppelpunkt', '(?<=: )(.+)$', 'Alles nach dem ersten Doppelpunkt', 4],
            ];

            $stmt = $db->prepare('INSERT INTO predefined_title_patterns (name, pattern, description, sort_order) VALUES (?, ?, ?, ?)');
            foreach ($titlePatterns as $p) {
                $stmt->execute($p);
            }

            $sePatterns = [
                ['(S01/E01)', '(?<=S)(\\d{2,4})(?=\\s*/E\\d{2,4})', '(?<=\\bS\\d{2,4}\\s*/E)(\\d{2,4})(?=\\))', 'Format: (S01/E01)', 0],
                ['Staffel X, Folge Y', '(?<=Staffel\\s)(\\d{1,4})(?=, Folge)', '(?<=Folge\\s)(\\d{1,4})(?=\\))', 'Format: Staffel 1, Folge 2', 1],
                ['S01E01', '(?<=S)(\\d{2})(?=E)', '(?<=E)(\\d{2})', 'Format: S01E01', 2],
                ['Episode (XXX)', null, '\\((\\d+)\\)', 'Nur Episodennummer in Klammern', 3],
            ];

            $stmt = $db->prepare('INSERT INTO predefined_season_episode_patterns (name, season_pattern, episode_pattern, description, sort_order) VALUES (?, ?, ?, ?, ?)');
            foreach ($sePatterns as $p) {
                $stmt->execute($p);
            }

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
