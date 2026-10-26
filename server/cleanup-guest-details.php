<?php
// Safe to schedule independently of the demo order cleanup command.
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/bootstrap.php';
[$config,$store]=dyws_app_bootstrap();
(new \dyws\GuestDetails($store,$config))->prune();
echo "Expired saved checkout details removed.\n";
