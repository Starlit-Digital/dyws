<?php
declare(strict_types=1);
// Compatibility include. The implementation belongs to the bundled Stripe plugin.
require_once __DIR__.'/../../../plugins/stripe/StripePayments.php';
if(!class_exists('dyws\\StripePayments',false))class_alias('dyws\\Plugins\\Stripe\\StripePayments','dyws\\StripePayments');
