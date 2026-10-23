<?php
require_once __DIR__.'/../private/dyws/module.php';
$catalog=dyws_load_catalog(__DIR__.'/../private/catalog.json');
?>
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DYWS module example</title><link rel="stylesheet" href="assets/dyws/dyws.css"><script type="module" src="site.js"></script></head>
<body><header><h1>A separate example shop</h1><p>This page includes DYWS as a module. It has no diner files.</p></header><main>
<h2>A category panel</h2>
<?= dyws_render_category($catalog,'goods') ?>
<p>The host can put its own content between module calls.</p>
<h2>A featured item</h2>
<?= dyws_render_item($catalog,'tote') ?>
</main><dyws-ordering catalog="api.php?route=/catalog" storage-key="dyws-example-shop"></dyws-ordering></body></html>
