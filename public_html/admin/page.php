<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
dyws_require_admin($config,$store);
dyws_admin_redirect($config,'orders');
