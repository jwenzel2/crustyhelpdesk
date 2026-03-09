<?php
/**
 * CrustyHelpdesk Installer
 *
 * Checks dependencies, sets up the database schema, and creates the default admin account.
 * DELETE THIS FILE after installation is complete.
 */

// Prevent timeout on slow operations
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
    // Strip leading 'v' (e.g. "v20.11.0" → "20.11.0")
    return ltrim(trim($raw), 'vV');
}

function check_icon(bool $ok): string {
    return $ok ? '<span style="color:green;font-weight:bold;">PASS</span>'
               : '<span style="color:red;font-weight:bold;">FAIL</span>';
}

// ---------------------------------------------------------------------------
// Gather info
// ---------------------------------------------------------------------------

$projectRoot = __DIR__;
$steps       = [];
$allPassed   = true;

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
// Step 3 — Check .env exists
// ---------------------------------------------------------------------------

$envFile   = $projectRoot . DIRECTORY_SEPARATOR . '.env';
$envExists = file_exists($envFile);

if (!$envExists) {
    // Try to copy from .env.example
    $exampleFile = $projectRoot . DIRECTORY_SEPARATOR . '.env.example';
    if (file_exists($exampleFile)) {
        $envExists = copy($exampleFile, $envFile);
    }
}

$steps[] = [
    'name'   => '.env file',
    'ok'     => $envExists,
    'detail' => $envExists
        ? '.env file present'
        : 'Missing .env file. Copy .env.example to .env and configure it.',
];
if (!$envExists) $allPassed = false;

// ---------------------------------------------------------------------------
// Step 4 — Check package.json
// ---------------------------------------------------------------------------

$pkgJson = file_exists($projectRoot . DIRECTORY_SEPARATOR . 'package.json');
$steps[] = [
    'name'   => 'package.json',
    'ok'     => $pkgJson,
    'detail' => $pkgJson ? 'Found' : 'Missing — are you running install.php from the project root?',
];
if (!$pkgJson) $allPassed = false;

// ---------------------------------------------------------------------------
// Stop here if prerequisites fail
// ---------------------------------------------------------------------------

if (!$allPassed) {
    render($steps, $allPassed, 'Prerequisites failed. Fix the issues above before continuing.');
    exit;
}

// ---------------------------------------------------------------------------
// Step 5 — npm install (if node_modules missing)
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
// Step 6 — Prisma generate
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
// Step 7 — Prisma migrate (create database + tables)
// ---------------------------------------------------------------------------

if ($allPassed) {
    $migrate = run_command("cd \"{$projectRoot}\" && npx prisma migrate dev --name init");
    // migrate dev may return 0 even if migration already applied — that's fine
    $migrateOk = $migrate['code'] === 0;

    // Check if it says "already in sync" — still a success
    if (!$migrateOk && stripos($migrate['output'], 'already in sync') !== false) {
        $migrateOk = true;
    }

    $steps[] = [
        'name'   => 'Database migration',
        'ok'     => $migrateOk,
        'detail' => $migrateOk
            ? 'Database schema created / up to date.'
            : "Migration failed:\n" . $migrate['output'],
    ];
    if (!$migrateOk) $allPassed = false;
}

// ---------------------------------------------------------------------------
// Step 8 — Seed admin user
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
// Render output
// ---------------------------------------------------------------------------

$finalMessage = $allPassed
    ? 'Installation complete! Default login: <strong>admin</strong> / <strong>admin</strong>.<br>
       Run <code>npm run dev</code> to start the development server.<br><br>
       <strong style="color:red;">DELETE THIS FILE (install.php) NOW.</strong>'
    : 'Installation encountered errors. Review the details above.';

render($steps, $allPassed, $finalMessage);

// ---------------------------------------------------------------------------

function render(array $steps, bool $allPassed, string $message): void {
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
                      font-weight: 600; font-size: .95rem; }
        code { background: #f3f4f6; padding: .15rem .4rem; border-radius: 3px; font-size: .85rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>CrustyHelpdesk Installer</h1>
        <p class="subtitle">Dependency check &amp; database setup</p>

        <div class="card">
            <table>
                <thead>
                    <tr><th>Step</th><th>Status</th><th>Details</th></tr>
                </thead>
                <tbody>
                <?php foreach ($steps as $i => $s): ?>
                    <tr>
                        <td><?= ($i + 1) . '. ' . htmlspecialchars($s['name']) ?></td>
                        <td><?= check_icon($s['ok']) ?></td>
                        <td class="detail">
                            <?php if (str_contains($s['detail'], "\n")): ?>
                                <pre><?= htmlspecialchars($s['detail']) ?></pre>
                            <?php else: ?>
                                <?= htmlspecialchars($s['detail']) ?>
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
