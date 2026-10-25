<?php
declare(strict_types=1);
use dyws\PluginContext;
use dyws\Plugins\OrderPrinter\PrinterService;
require_once __DIR__.'/PrinterService.php';
return #[\dyws\Provides('admin:settings')] static function(PluginContext $plugin):void {
    $service = fn() => new PrinterService($plugin->config, $plugin->store);
    $plugin->route('GET', '/manager/plugins/order-printer/settings', 'manager', fn() => $service()->summary());
    $plugin->route('POST', '/manager/plugins/order-printer/devices', 'manager', fn(array $body) => $service()->createDevice($body));
    $plugin->route('POST', '/manager/plugins/order-printer/manage', 'manager', fn(array $body) => $service()->manage($body));
    // Public here means custom device authentication, not anonymous access to orders.
    $plugin->route('POST', '/plugins/order-printer/enroll', 'public', fn(array $body) => $service()->enroll($body), ['maxBody'=>2048, 'rateLimit'=>['printer-enroll',20,900]]);
    foreach (['poll', 'ack'] as $action) {
        $plugin->route('POST', '/plugins/order-printer/'.$action, 'public',
            fn(array $body, ?array $session, array $request) => $service()->deviceRequest($action, $body, $request['server']),
            ['maxBody'=>2048, 'rateLimit'=>['printer-device',600,60]]);
    }
    // Poll reconciliation is authoritative; optional observer failures cannot lose jobs.
    $plugin->addAction('order.status_changed', fn() => $service()->reconcileAll());
};
