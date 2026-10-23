<?php
declare(strict_types=1);
require_once __DIR__.'/../modules/dyws/php/module.php';
if(is_file(__DIR__.'/../vendor/autoload.php'))require_once __DIR__.'/../vendor/autoload.php';
function starlit_config_path():string {return getenv('DYWS_CONFIG')?:getenv('STARLIT_GO_CONFIG')?:__DIR__.'/../var/config.json';}
function starlit_bootstrap():array {return dyws_bootstrap(starlit_config_path());}
