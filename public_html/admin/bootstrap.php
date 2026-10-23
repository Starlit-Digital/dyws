<?php
declare(strict_types=1);
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
ini_set('display_errors','0');
try {
 $bootstrap=getenv('DYWS_BOOTSTRAP')?:__DIR__.'/../../server/bootstrap.php';
 if(is_file(__DIR__.'/../api/bootstrap-path.php'))$bootstrap=require __DIR__.'/../api/bootstrap-path.php';
 require_once $bootstrap;
 [$config,$store]=dyws_app_bootstrap();
}catch(Throwable $e){
 error_log('dyws admin initialization failure: '.$e->getMessage());
 http_response_code(503);echo 'Sign in is temporarily unavailable. Please try again shortly.';exit;
}
