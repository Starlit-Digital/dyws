<?php
declare(strict_types=1);
require __DIR__.'/../admin/bootstrap.php';
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
$siteCatalog=\dyws\Catalog::load($config['catalog']);
$siteName=htmlspecialchars($siteCatalog['businessName'],ENT_QUOTES,'UTF-8');
?>
<!doctype html>
<html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>My account | <?=$siteName?></title><link rel="stylesheet" href="../demo.css"><link rel="stylesheet" href="../dyws/dyws.css"><link rel="stylesheet" href="../dyws/customer-account.css"><script src="../appearance-init.js"></script><script type="module" src="./account.js"></script></head>
<body class="dyws-shell dyws-customer"><header class="dyws-customer-header"><a href="../"><?=$siteName?></a><span>My account</span></header><main class="dyws-account"><h1>My account</h1><p data-account-message role="status" aria-live="polite">Opening your account…</p><p data-account-error role="alert"></p><div data-account-root></div><noscript>Enable JavaScript to sign in and view your orders.</noscript></main><footer><a href="../">Back to ordering</a> · <a href="../terms/">Privacy and terms</a></footer></body></html>
