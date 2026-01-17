<?php
require_once 'config.php';

// Check if the database already exists
if (file_exists(DB_PATH)) {
    die("Database already exists. To reinstall, delete the database file.");
}

// If form submitted, process the setup
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username']);
    $password = trim($_POST['password']);
    $confirmPassword = trim($_POST['confirm_password']);

    if (empty($username) || empty($password)) {
        $error = "Username and password are required.";
    } elseif ($password !== $confirmPassword) {
        $error = "Passwords do not match.";
    } else {
        // Create database and tables
        $db = new PDO('sqlite:' . DB_PATH);
        $db->exec("
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );
		
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
			mediaId INTEGER NOT NULL,
			topic TEXT NOT NULL,
			priority INTEGER NOT NULL,
			filters TEXT NOT NULL,
			titleRegexRules TEXT,
			episodeRegex TEXT,
			seasonRegex TEXT,
			matchingStrategy TEXT NOT NULL,
			FOREIGN KEY(mediaId) REFERENCES media(id) ON DELETE CASCADE
		);
        ");

        // Insert admin user
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $db->prepare("INSERT INTO users (username, password) VALUES (:username, :password)");
        $stmt->execute([':username' => $username, ':password' => $hashedPassword]);

        echo "<p>Setup complete. Admin user created.</p>";
        exit;
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
    <?php if (isset($error)): ?>
        <p style="color: red;"><?php echo htmlspecialchars($error); ?></p>
    <?php endif; ?>
    <form method="post">
        <label for="username">Admin Username:</label><br>
        <input type="text" id="username" name="username" required><br><br>

        <label for="password">Password:</label><br>
        <input type="password" id="password" name="password" required><br><br>

        <label for="confirm_password">Confirm Password:</label><br>
        <input type="password" id="confirm_password" name="confirm_password" required><br><br>

        <button type="submit">Create Admin Account</button>
    </form>
</body>
</html>
