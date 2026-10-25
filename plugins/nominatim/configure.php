<?php
// Provision from a private JSON credential on stdin, never a command line password.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
umask(0077);
require_once __DIR__.'/../../server/bootstrap.php';
require_once __DIR__.'/AddressLookup.php';
$path=$argv[1]??'';
if(!is_file($path))throw new RuntimeException('Supply the existing private config.json path.');
$config=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
$client=json_decode(stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);
(new \dyws\Plugins\Nominatim\AddressLookup($config))->provision($client);
echo "Address service configured. Credentials encrypted outside the web root.\n";
