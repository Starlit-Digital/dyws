<?php
// Safe for ordinary merchant installations. Does not remove accounts or business records.
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/bootstrap.php';
[$config,$store]=dyws_app_bootstrap();
(new \dyws\CustomerAccounts($store,$config))->prune();
echo "Expired customer sign in links and sessions removed.\n";
