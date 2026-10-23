<?php
declare(strict_types=1);
ini_set('display_errors','0');
try {
 $bootstrap=getenv('STARLIT_GO_BOOTSTRAP')?:__DIR__.'/../../server/bootstrap.php';
 if(is_file(__DIR__.'/bootstrap-path.php'))$bootstrap=require __DIR__.'/bootstrap-path.php';
 require_once $bootstrap;
 dyws_serve_api(bootstrap:'starlit_bootstrap');
}catch(Throwable $e){
 error_log('DYWS initialization failure: '.$e->getMessage());
 http_response_code(503);header('Content-Type: application/json');header('Cache-Control: no-store');
 echo json_encode(['error'=>'The order service is temporarily unavailable.']);
}
