<?php
// A dedicated JSON endpoint. Never dispatch the API while rendering the homepage.
if(is_file(__DIR__.'/../private/vendor/autoload.php'))require_once __DIR__.'/../private/vendor/autoload.php';
require_once __DIR__.'/../private/dyws/module.php';
dyws_serve_api(__DIR__.'/../private/config.json');
