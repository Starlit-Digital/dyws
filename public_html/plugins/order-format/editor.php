<?php
declare(strict_types=1);
require __DIR__.'/../../admin/bootstrap.php';
$adminToken=dyws_require_admin($config,$store);
$boot=dyws_admin_data($config,$store,'plugins');
$active=in_array('order-format',array_column($boot['responses']['/plugins']['plugins'],'id'),true);
?>
<!doctype html><html lang="en-CA"><head>
<?=dyws_admin_meta($config,$adminToken)?><?=dyws_admin_initial_head($boot,dirname(__DIR__,2),'../../')?>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self' wss: ws://127.0.0.1:* ws://localhost:*; object-src 'none'; base-uri 'self'; form-action 'self'">
<link rel="stylesheet" href="../../dyws/dyws.css?v=40"><link rel="stylesheet" href="./editor.css?v=1.0.0"><script type="module" src="./editor.js?v=1.0.0"></script><title>Order forms | dyws</title><?=dyws_render_customer_startup_head('../../')?></head>
<body class="dyws-shell dyws-admin dyws-form-editor" data-admin-page="order-forms" data-order-format-active="<?=$active?'true':'false'?>" data-order-format-locked="<?=!empty($config['demo_lockdown'])?'true':'false'?>"><?=dyws_render_customer_startup_skeleton()?>
<header class="dyws-admin-header"><a class="dyws-admin-brand" href="../../"><img src="../../assets/dyws.svg" alt="" width="44" height="44"><span>dyws</span></a><details class="dyws-admin-menu" open><summary aria-label="Administration pages"><span data-dyws-page-title>Order forms</span><span aria-hidden="true">⌄</span></summary><nav class="dyws-admin-tabs" aria-label="Administration" data-dyws-admin-nav><?=dyws_admin_navigation($config,$boot)?></nav></details><button type="button" data-admin-logout class="dyws-secondary" hidden>Sign out</button></header>
<main><div class="dyws-format-heading"><div><p class="dyws-format-eyebrow">ORDER FORMAT</p><h1>Order forms</h1><p>Arrange each step of your customer’s order.</p></div><a href="../../" target="_blank" rel="noopener" class="dyws-link-button dyws-secondary">Open storefront ↗</a></div>
<div data-admin-content hidden><div data-format-editor></div></div><p data-admin-error class="dyws-error" role="alert"></p></main></body></html>
