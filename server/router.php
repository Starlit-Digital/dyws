<?php
/** Development equivalent of DirectoryIndex. Serve only the known public entrypoints. */
$root=realpath(__DIR__.'/../public_html');
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
$routes=['/'=>'home.php','/api/'=>'api/endpoint.php','/setup/'=>'setup/install.php','/account/orders/'=>'account/orders/page.php','/account/sign-in/'=>'account/sign-in/page.php'];
foreach(['admin','auth','orders','reports','catalog','drivers','password','settings','plugins','driver','tracking','terms','account'] as $page)$routes['/'.$page.'/']=$page.'/page.php';
if(isset($routes[$path])&&is_file($root.'/'.$routes[$path])){require $root.'/'.$routes[$path];return true;}
if(isset($routes[$path.'/'])&&is_file($root.'/'.$routes[$path.'/'])){header('Location: '.$path.'/',true,301);return true;}
return false;
