<?php
declare(strict_types=1);
require __DIR__.'/../admin/bootstrap.php';
$adminToken=dyws_require_admin($config,$store);
$boot=dyws_admin_data($config,$store,'plugins');
$id=$_GET['plugin']??'';$plugin=null;
if(is_string($id))foreach($boot['responses']['/manager/plugins']['plugins'] as $record)if($record['id']===$id)$plugin=$record;
if(!$plugin){http_response_code(404);echo 'Plugin not found.';exit;}
$escape=static fn($value)=>htmlspecialchars($value,ENT_QUOTES,'UTF-8');
?>
<!doctype html><html lang="en-CA"><head><?=dyws_admin_meta($config,$adminToken)?><?=dyws_admin_initial_head($boot,dirname(__DIR__))?><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self' wss: ws://127.0.0.1:* ws://localhost:*; object-src 'none'; base-uri 'self'; form-action 'self'"><link rel="stylesheet" href="../dyws/dyws.css?v=40"><script type="module" src="../dyws/plugin-edit.js"></script><title><?=$escape($plugin['name'])?> | Plugins</title><?=dyws_render_customer_startup_head('../')?></head>
<body class="dyws-shell dyws-admin" data-admin-page="plugins" data-edit-plugin="<?=$escape($id)?>"><?=dyws_render_customer_startup_skeleton()?><header class="dyws-admin-header"><a class="dyws-admin-brand" href="../"><img src="../assets/dyws.svg" alt="" width="44" height="44"><span>dyws</span></a><details class="dyws-admin-menu" open><summary aria-label="Administration pages"><span data-dyws-page-title>Plugins</span><span aria-hidden="true">⌄</span></summary><nav class="dyws-admin-tabs" aria-label="Administration" data-dyws-admin-nav><?=dyws_admin_navigation($config,$boot)?></nav></details><button type="button" data-admin-logout class="dyws-secondary" hidden>Sign out</button></header>
<main><a href="./" class="dyws-link-button dyws-secondary">Back to plugins</a><h1><?=$escape($plugin['name'])?></h1><p><?=$escape($plugin['description'])?></p><div data-admin-content hidden><p data-plugin-edit-state role="status"></p><button type="button" data-plugin-edit-activate hidden>Activate</button><div data-dyws-plugin-settings></div></div><p data-admin-error class="dyws-error" role="alert"></p></main></body></html>
