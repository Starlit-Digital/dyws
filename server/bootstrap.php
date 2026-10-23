<?php
declare(strict_types=1);
require_once __DIR__.'/../modules/dyws/php/module.php';
if(is_file(__DIR__.'/../vendor/autoload.php'))require_once __DIR__.'/../vendor/autoload.php';
function dyws_config_path():string {return getenv('DYWS_CONFIG')?:__DIR__.'/../var/config.json';}
function dyws_app_bootstrap():array {return dyws_bootstrap(dyws_config_path());}
