<?php
declare(strict_types=1);
require __DIR__.'/../admin/bootstrap.php';
$auth=dyws_admin_auth($config,$store);
?>
<!doctype html>
<html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Sign in | dyws</title><link rel="stylesheet" href="../dyws/dyws.css?v=37"></head><body class="dyws-shell dyws-auth"><main><section><h1>Sign in</h1><form method="post" action="<?=htmlspecialchars(dyws_admin_base($config).'/auth/'.(($_GET['diagnostics']??'')==='1'?'?diagnostics=1':''),ENT_QUOTES,'UTF-8')?>"><input type="hidden" name="csrf" value="<?=htmlspecialchars($auth['csrf'],ENT_QUOTES,'UTF-8')?>"><label>Password<input name="password" type="password" autocomplete="current-password" required autofocus maxlength="200"></label><button type="submit">Sign in</button><?php if($auth['error']!==''):?><p class="dyws-error" role="alert"><?=htmlspecialchars($auth['error'],ENT_QUOTES,'UTF-8')?></p><?php endif;?></form></section></main></body></html>
