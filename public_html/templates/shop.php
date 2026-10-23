<?php
// Selected only by the installed site's private JSON configuration.
if(!isset($catalog)) {http_response_code(404);exit;}
$name=htmlspecialchars($catalog['businessName'],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?=$name?> | dyws</title><link rel="stylesheet" href="dyws/dyws.css"><script type="module" src="demo.js"></script></head><body class="dyws-shell"><header><a href="./"><img src="assets/dyws.svg" width="44" height="44" alt="dyws"></a><h1><?=$name?></h1><p>Test orders only. No real charges or deliveries.</p></header><nav aria-label="Menu categories"><?=dyws_render_navigation($catalog)?></nav><main><div id="menu"><?=dyws_render_menu($catalog)?></div><?php if(!$catalog['categories']): ?><p>The catalog is being prepared.</p><?php endif; ?></main><footer><a href="manager.html">Admin</a></footer><dyws-ordering catalog="api/index.php?route=/catalog" storage-key="dyws-cart"></dyws-ordering></body></html>
