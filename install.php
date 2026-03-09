<?php
/**
 * CrustyHelpdesk Installer
 *
 * Phase 1: Prompts for database credentials and writes .env
 * Phase 2: Checks dependencies, creates database, runs migrations, seeds admin user
 *
 * DELETE THIS FILE after installation is complete.
 */

set_time_limit(300);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run_command(string $cmd): array {
    $output = [];
    $code   = 1;
    exec($cmd . ' 2>&1', $output, $code);
    return ['output' => implode("\n", $output), 'code' => $code];
}

function version_from_output(string $raw): string {
    return ltrim(trim($raw), 'vV');
}

function check_icon(bool $ok): string {
    return $ok ? '<span style="color:green;font-weight:bold;">PASS</span>'
               : '<span style="color:red;font-weight:bold;">FAIL</span>';
}

function esc(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

$projectRoot = __DIR__;
$envFile     = $projectRoot . DIRECTORY_SEPARATOR . '.env';

// ---------------------------------------------------------------------------
// Phase 1 — Configuration form
// ---------------------------------------------------------------------------

$phase = ($_POST['phase'] ?? '') === 'install' ? 'install' : 'configure';

// If .env doesn't exist and we haven't submitted the form yet, show the form
if ($phase === 'configure') {
    // Pre-populate from existing .env if present
    $defaults = [
        'db_host'     => 'localhost',
        'db_port'     => '3306',
        'db_name'     => 'crustyhelpdesk',
        'db_user'     => 'root',
        'db_pass'     => '',
        'auth_secret' => bin2hex(random_bytes(32)),
    ];

    if (file_exists($envFile)) {
        foreach (explode("\n", file_get_contents($envFile)) as $line) {
            $line = trim($line);
            if (str_starts_with($line, 'DATABASE_URL=')) {
                $url = trim(substr($line, strlen('DATABASE_URL=')), '"\'');
                $pattern = '#^mysql://([^:]*):([^@]*)@([^:/?]+)(?::(\d+))?/(.+)$#';
                if (preg_match($pattern, $url, $m)) {
                    $defaults['db_user'] = urldecode($m[1]);
                    $defaults['db_pass'] = urldecode($m[2]);
                    $defaults['db_host'] = $m[3];
                    $defaults['db_port'] = $m[4] ?: '3306';
                    $defaults['db_name'] = $m[5];
                }
            }
            if (str_starts_with($line, 'AUTH_SECRET=')) {
                $defaults['auth_secret'] = trim(substr($line, strlen('AUTH_SECRET=')), '"\'');
            }
        }
    }

    $error = $_GET['error'] ?? '';

    render_form($defaults, $error);
    exit;
}

// ---------------------------------------------------------------------------
// Phase 2 — Process form and run installation
// ---------------------------------------------------------------------------

$dbHost   = trim($_POST['db_host'] ?? 'localhost');
$dbPort   = trim($_POST['db_port'] ?? '3306');
$dbName   = trim($_POST['db_name'] ?? 'crustyhelpdesk');
$dbUser   = trim($_POST['db_user'] ?? 'root');
$dbPass   = $_POST['db_pass'] ?? '';
$authSecret = trim($_POST['auth_secret'] ?? bin2hex(random_bytes(32)));

// Basic validation
if (empty($dbHost) || empty($dbName) || empty($dbUser)) {
    header('Location: install.php?error=' . urlencode('Database host, name, and user are required.'));
    exit;
}

// Sanitize database name (alphanumeric, underscore, hyphen only)
if (!preg_match('/^[a-zA-Z0-9_-]+$/', $dbName)) {
    header('Location: install.php?error=' . urlencode('Database name must contain only letters, numbers, underscores, and hyphens.'));
    exit;
}

$steps     = [];
$allPassed = true;

// ---------------------------------------------------------------------------
// Step 1 — Check Node.js
// ---------------------------------------------------------------------------

$node = run_command('node -v');
$nodeVersion = version_from_output($node['output']);
$nodeOk = $node['code'] === 0 && version_compare($nodeVersion, '18.0.0', '>=');

$steps[] = [
    'name'   => 'Node.js >= 18',
    'ok'     => $nodeOk,
    'detail' => $node['code'] === 0
        ? "Found Node.js {$nodeVersion}"
        : 'Node.js not found. Install from https://nodejs.org/',
];
if (!$nodeOk) $allPassed = false;

// ---------------------------------------------------------------------------
// Step 2 — Check npm
// ---------------------------------------------------------------------------

$npm = run_command('npm -v');
$npmVersion = version_from_output($npm['output']);
$npmOk = $npm['code'] === 0 && version_compare($npmVersion, '9.0.0', '>=');

$steps[] = [
    'name'   => 'npm >= 9',
    'ok'     => $npmOk,
    'detail' => $npm['code'] === 0
        ? "Found npm {$npmVersion}"
        : 'npm not found. It ships with Node.js — reinstall Node.',
];
if (!$npmOk) $allPassed = false;

// ---------------------------------------------------------------------------
// Step 3 — Check package.json
// ---------------------------------------------------------------------------

$pkgJson = file_exists($projectRoot . DIRECTORY_SEPARATOR . 'package.json');
$steps[] = [
    'name'   => 'package.json',
    'ok'     => $pkgJson,
    'detail' => $pkgJson ? 'Found' : 'Missing — are you running install.php from the project root?',
];
if (!$pkgJson) $allPassed = false;

// ---------------------------------------------------------------------------
// Step 4 — Connect to MySQL and create database
// ---------------------------------------------------------------------------

$dbOk = false;
$dbDetail = '';

if (!extension_loaded('mysqli')) {
    $dbDetail = "PHP mysqli extension not loaded. Install it (e.g. apt install php-mysql) and retry.";
} else {
    mysqli_report(MYSQLI_REPORT_OFF);
    $conn = @new mysqli($dbHost, $dbUser, $dbPass, '', (int)$dbPort);
    if ($conn->connect_error) {
        $dbDetail = "Connection failed: {$conn->connect_error}";
    } else {
        $serverInfo = $conn->server_info;
        $safeDbName = $conn->real_escape_string($dbName);

        $dbExisted = (bool)$conn->select_db($dbName);

        if (!$dbExisted) {
            $created = $conn->query("CREATE DATABASE `{$safeDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            if ($created && $conn->select_db($dbName)) {
                $dbDetail = "Connected to {$dbHost}:{$dbPort} (Server: {$serverInfo}). "
                          . "Database '{$dbName}' created successfully.";
                $dbOk = true;
            } else {
                $dbDetail = "Connected but could not create database '{$dbName}': {$conn->error}. "
                          . "Check that '{$dbUser}' has CREATE privileges.";
            }
        } else {
            $dbDetail = "Connected to {$dbHost}:{$dbPort} (Server: {$serverInfo}). "
                      . "Database '{$dbName}' already exists.";
            $dbOk = true;
        }
        $conn->close();
    }
}

$steps[] = [
    'name'   => 'MariaDB/MySQL database',
    'ok'     => $dbOk,
    'detail' => $dbDetail,
];
if (!$dbOk) $allPassed = false;

// ---------------------------------------------------------------------------
// Step 5 — Write .env file
// ---------------------------------------------------------------------------

if ($allPassed) {
    $encodedUser = rawurlencode($dbUser);
    $encodedPass = rawurlencode($dbPass);
    $databaseUrl = "mysql://{$encodedUser}:{$encodedPass}@{$dbHost}:{$dbPort}/{$dbName}";

    $envContent = <<<ENV
DATABASE_URL="{$databaseUrl}"
AUTH_SECRET="{$authSecret}"
AUTH_PROVIDER="local"
ENV;

    $written = file_put_contents($envFile, $envContent . "\n");
    $envOk = $written !== false;

    $steps[] = [
        'name'   => 'Write .env',
        'ok'     => $envOk,
        'detail' => $envOk
            ? ".env written with DATABASE_URL for '{$dbName}'"
            : "Failed to write .env — check file permissions on {$projectRoot}",
    ];
    if (!$envOk) $allPassed = false;
}

// ---------------------------------------------------------------------------
// Stop here if prerequisites fail
// ---------------------------------------------------------------------------

if (!$allPassed) {
    render_results($steps, $allPassed, 'Prerequisites failed. Fix the issues above, then <a href="install.php" style="color:#fff;text-decoration:underline;">try again</a>.');
    exit;
}

// ---------------------------------------------------------------------------
// Step 6 — npm install
// ---------------------------------------------------------------------------

$nodeModulesExists = is_dir($projectRoot . DIRECTORY_SEPARATOR . 'node_modules');

if ($nodeModulesExists) {
    $steps[] = [
        'name'   => 'npm install',
        'ok'     => true,
        'detail' => 'node_modules/ already exists — skipped.',
    ];
} else {
    $install = run_command("cd \"{$projectRoot}\" && npm install");
    $installOk = $install['code'] === 0;
    $steps[] = [
        'name'   => 'npm install',
        'ok'     => $installOk,
        'detail' => $installOk
            ? 'Dependencies installed successfully.'
            : "npm install failed:\n" . $install['output'],
    ];
    if (!$installOk) $allPassed = false;
}

// ---------------------------------------------------------------------------
// Step 7 — Prisma generate
// ---------------------------------------------------------------------------

if ($allPassed) {
    $generate = run_command("cd \"{$projectRoot}\" && npx prisma generate");
    $genOk = $generate['code'] === 0;
    $steps[] = [
        'name'   => 'Prisma generate',
        'ok'     => $genOk,
        'detail' => $genOk
            ? 'Prisma client generated.'
            : "prisma generate failed:\n" . $generate['output'],
    ];
    if (!$genOk) $allPassed = false;
}

// ---------------------------------------------------------------------------
// Step 8 — Prisma migrate (create tables)
// ---------------------------------------------------------------------------

if ($allPassed) {
    // Clean up any stale migration_lock.toml from a previous provider (e.g. sqlite)
    $lockFile = $projectRoot . DIRECTORY_SEPARATOR . 'prisma' . DIRECTORY_SEPARATOR
              . 'migrations' . DIRECTORY_SEPARATOR . 'migration_lock.toml';
    if (file_exists($lockFile)) {
        $lockContents = file_get_contents($lockFile);
        if (str_contains($lockContents, 'provider = "sqlite"')) {
            // Provider mismatch — wipe the migrations directory so Prisma starts fresh
            $migrationsDir = $projectRoot . DIRECTORY_SEPARATOR . 'prisma' . DIRECTORY_SEPARATOR . 'migrations';
            $files = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($migrationsDir, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::CHILD_FIRST
            );
            foreach ($files as $file) {
                $file->isDir() ? rmdir($file->getRealPath()) : unlink($file->getRealPath());
            }
        }
    }

    $migrate = run_command("cd \"{$projectRoot}\" && npx prisma migrate dev --name init");
    $migrateOk = $migrate['code'] === 0;

    if (!$migrateOk && stripos($migrate['output'], 'already in sync') !== false) {
        $migrateOk = true;
    }

    $steps[] = [
        'name'   => 'Database migration',
        'ok'     => $migrateOk,
        'detail' => $migrateOk
            ? 'Database tables created / up to date.'
            : "Migration failed:\n" . $migrate['output'],
    ];
    if (!$migrateOk) $allPassed = false;
}

// ---------------------------------------------------------------------------
// Step 9 — Seed admin user
// ---------------------------------------------------------------------------

if ($allPassed) {
    $seed = run_command("cd \"{$projectRoot}\" && npx tsx prisma/seed.ts");
    $seedOk = $seed['code'] === 0;
    $steps[] = [
        'name'   => 'Seed admin user',
        'ok'     => $seedOk,
        'detail' => $seedOk
            ? trim($seed['output'])
            : "Seed failed:\n" . $seed['output'],
    ];
    if (!$seedOk) $allPassed = false;
}

// ---------------------------------------------------------------------------
// Render results
// ---------------------------------------------------------------------------

$finalMessage = $allPassed
    ? 'Installation complete! Default login: <strong>admin</strong> / <strong>admin</strong>.<br>
       Run <code>npm run dev</code> to start the development server.<br><br>
       <strong style="color:red;">DELETE THIS FILE (install.php) NOW.</strong>'
    : 'Installation encountered errors. Review the details above, then <a href="install.php" style="color:#fff;text-decoration:underline;">try again</a>.';

render_results($steps, $allPassed, $finalMessage);

// ===========================================================================
// Render functions
// ===========================================================================

function render_form(array $defaults, string $error): void {
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CrustyHelpdesk Installer</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
               background: #f3f4f6; color: #1f2937; padding: 2rem; }
        .container { max-width: 520px; margin: 0 auto; }
        h1 { font-size: 1.5rem; margin-bottom: .25rem; }
        .subtitle { color: #6b7280; margin-bottom: 1.5rem; }
        .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1);
                padding: 1.5rem; margin-bottom: 1rem; }
        .section-title { font-size: .85rem; font-weight: 600; text-transform: uppercase;
                         color: #6b7280; margin-bottom: .75rem; letter-spacing: .03em; }
        .form-group { margin-bottom: 1rem; }
        .form-row { display: flex; gap: .75rem; }
        .form-row .form-group { flex: 1; }
        label { display: block; font-size: .85rem; font-weight: 500; color: #374151; margin-bottom: .25rem; }
        input[type="text"], input[type="password"], input[type="number"] {
            width: 100%; padding: .5rem .75rem; border: 1px solid #d1d5db; border-radius: 6px;
            font-size: .9rem; color: #1f2937; background: #fff; }
        input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
        .hint { font-size: .75rem; color: #9ca3af; margin-top: .2rem; }
        .error-box { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
                     padding: .75rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: .85rem; }
        .divider { border: 0; border-top: 1px solid #e5e7eb; margin: 1.25rem 0; }
        button { width: 100%; padding: .65rem; background: #2563eb; color: #fff; border: none;
                 border-radius: 6px; font-size: .95rem; font-weight: 600; cursor: pointer; }
        button:hover { background: #1d4ed8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>CrustyHelpdesk Installer</h1>
        <p class="subtitle">Configure your database connection</p>

        <?php if ($error): ?>
            <div class="error-box"><?= esc($error) ?></div>
        <?php endif; ?>

        <form method="POST" action="install.php" class="card">
            <input type="hidden" name="phase" value="install">

            <div class="section-title">MySQL / MariaDB Connection</div>

            <div class="form-row">
                <div class="form-group">
                    <label for="db_host">Host</label>
                    <input type="text" id="db_host" name="db_host" value="<?= esc($defaults['db_host']) ?>" required>
                </div>
                <div class="form-group" style="max-width:100px;">
                    <label for="db_port">Port</label>
                    <input type="number" id="db_port" name="db_port" value="<?= esc($defaults['db_port']) ?>" required>
                </div>
            </div>

            <div class="form-group">
                <label for="db_name">Database Name</label>
                <input type="text" id="db_name" name="db_name" value="<?= esc($defaults['db_name']) ?>" required>
                <div class="hint">Will be created if it doesn't exist</div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="db_user">Username</label>
                    <input type="text" id="db_user" name="db_user" value="<?= esc($defaults['db_user']) ?>" required>
                </div>
                <div class="form-group">
                    <label for="db_pass">Password</label>
                    <input type="password" id="db_pass" name="db_pass" value="<?= esc($defaults['db_pass']) ?>">
                </div>
            </div>

            <hr class="divider">
            <div class="section-title">Application</div>

            <div class="form-group">
                <label for="auth_secret">Auth Secret</label>
                <input type="text" id="auth_secret" name="auth_secret" value="<?= esc($defaults['auth_secret']) ?>" required>
                <div class="hint">Used to sign session tokens. Auto-generated — change in production.</div>
            </div>

            <hr class="divider">
            <button type="submit">Install CrustyHelpdesk</button>
        </form>
    </div>
</body>
</html>
<?php
}

function render_results(array $steps, bool $allPassed, string $message): void {
    $statusColor = $allPassed ? '#16a34a' : '#dc2626';
    $statusText  = $allPassed ? 'SUCCESS' : 'INCOMPLETE';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CrustyHelpdesk Installer</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
               background: #f3f4f6; color: #1f2937; padding: 2rem; }
        .container { max-width: 720px; margin: 0 auto; }
        h1 { font-size: 1.5rem; margin-bottom: .25rem; }
        .subtitle { color: #6b7280; margin-bottom: 1.5rem; }
        .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1);
                padding: 1.5rem; margin-bottom: 1rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: .6rem .75rem; border-bottom: 1px solid #e5e7eb; }
        th { font-size: .75rem; text-transform: uppercase; color: #6b7280; }
        td.detail { font-size: .85rem; color: #374151; }
        pre { background: #f9fafb; padding: .5rem; border-radius: 4px; font-size: .8rem;
              overflow-x: auto; white-space: pre-wrap; word-break: break-word; margin-top: .25rem; }
        .status-bar { padding: 1rem 1.5rem; border-radius: 8px; color: #fff;
                      font-weight: 600; font-size: .95rem; line-height: 1.6; }
        .status-bar a { color: #fff; }
        code { background: #f3f4f6; padding: .15rem .4rem; border-radius: 3px; font-size: .85rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>CrustyHelpdesk Installer</h1>
        <p class="subtitle">Installation progress</p>

        <div class="card">
            <table>
                <thead>
                    <tr><th>Step</th><th>Status</th><th>Details</th></tr>
                </thead>
                <tbody>
                <?php foreach ($steps as $i => $s): ?>
                    <tr>
                        <td><?= ($i + 1) . '. ' . esc($s['name']) ?></td>
                        <td><?= check_icon($s['ok']) ?></td>
                        <td class="detail">
                            <?php if (str_contains($s['detail'], "\n")): ?>
                                <pre><?= esc($s['detail']) ?></pre>
                            <?php else: ?>
                                <?= esc($s['detail']) ?>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="status-bar" style="background:<?= $statusColor ?>;">
            <?= $statusText ?>: <?= $message ?>
        </div>
    </div>
</body>
</html>
<?php
}
