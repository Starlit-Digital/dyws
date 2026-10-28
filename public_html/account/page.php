<?php
declare(strict_types=1);
require __DIR__.'/../admin/bootstrap.php';
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
$siteCatalog=\dyws\Catalog::load($config['catalog']);
$siteName=htmlspecialchars($siteCatalog['businessName'],ENT_QUOTES,'UTF-8');
$view=$dywsAccountView??'account';$ordersPage=$view==='orders';$signinPage=$view==='signin';
$prefix=($ordersPage||$signinPage)?'../../':'../';$title=$ordersPage?'My orders':($signinPage?'Sign in':'My account');
$presentation=$store->plugins?->applyFilters('page.presentation',[],$signinPage?'customer-signin':'customer-account')??[];
$signinLocked=($presentation['customerSignInLocked']??false)===true;
?>
<!doctype html>
<html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title><?=$title?> | <?=$siteName?></title><link rel="stylesheet" href="<?=$prefix?>demo.css"><link rel="stylesheet" href="<?=$prefix?>dyws/dyws.css"><link rel="stylesheet" href="<?=$prefix?>dyws/customer-account.css"><link rel="stylesheet" href="<?=$prefix?>dyws/customer-orders.css"><script src="<?=$prefix?>appearance-init.js"></script><script type="module" src="<?=$prefix?>account/navigation.js"></script><script type="module" src="<?=$prefix?>account/account.js"></script><?=dyws_render_customer_startup_head($prefix)?></head>
<body class="dyws-shell dyws-customer <?=$ordersPage?'dyws-customer-orders-page':''?>" data-demo-locked="<?=!empty($config['demo_lockdown'])?'true':'false'?>" data-store-name="<?=$siteName?>" data-account-view="<?=htmlspecialchars($view,ENT_QUOTES,'UTF-8')?>" data-signin-locked="<?=$signinLocked?'true':'false'?>">
<?=dyws_render_customer_startup_skeleton()?><a class="dyws-skip-link" href="#customer-main">Skip to account content</a><header class="dyws-customer-header dyws-site-header"><a href="<?=$prefix?>"><?=$siteName?></a><div class="dyws-header-actions"><?=dyws_render_customer_preferences()?><?=dyws_render_customer_account_link($config,$store,$prefix)?></div></header>
<main id="customer-main" class="dyws-account" tabindex="-1"><?php if(!$signinPage):?><nav class="dyws-account-navigation" aria-label="Customer account"><a href="<?=$prefix?>account/"<?=!$ordersPage?' aria-current="page"':''?>>Account</a><a href="<?=$prefix?>account/orders/"<?=$ordersPage?' aria-current="page"':''?>>Orders</a></nav><?php endif?><h1><?=$title?></h1><p data-account-message role="status" aria-live="polite"></p><p data-account-error role="alert"></p><div data-account-root></div><noscript>Enable JavaScript to sign in and view your orders.</noscript></main>
<footer><a href="<?=$prefix?>">Back to ordering</a> · <a href="<?=$prefix?>terms/">Privacy and terms</a></footer></body></html>
