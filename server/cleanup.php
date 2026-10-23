<?php
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/bootstrap.php';[$config,$store]=starlit_bootstrap();
$store->pruneLocations();
$store->transaction(function()use($store){$store->execute('DELETE FROM locations WHERE recorded_at<?',[time()-900]);$store->execute('DELETE FROM sessions WHERE expires_at<?',[time()]);$store->execute('DELETE FROM limits WHERE expires_at<?',[time()]);$store->execute("UPDATE orders SET customer_name='Deleted',customer_phone='',address='',address_json='{}',notes='' WHERE created_at<?",[time()-7*86400]);});echo "Expired GPS, sessions and demo contact details cleaned.\n";
