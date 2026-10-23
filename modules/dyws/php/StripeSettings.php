<?php
declare(strict_types=1);
// Compatibility include. The implementation belongs to the bundled Stripe plugin.
require_once __DIR__.'/../../../plugins/stripe/StripeSettings.php';
if(!class_exists('StarlitGo\\StripeSettings',false))class_alias('StarlitGo\\Plugins\\Stripe\\StripeSettings','StarlitGo\\StripeSettings');
