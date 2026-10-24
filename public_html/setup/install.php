<?php
declare(strict_types=1);
ini_set('display_errors','0');umask(0077);
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
function esc(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
$installer=null;$checks=[];$error='';$done=null;$step=1;
try{
 $bootstrap=getenv('DYWS_BOOTSTRAP')?:__DIR__.'/../../server/bootstrap.php';
 if(is_file(__DIR__.'/../api/bootstrap-path.php'))$bootstrap=require __DIR__.'/../api/bootstrap-path.php';
 require_once $bootstrap;
 require_once dirname($bootstrap).'/../modules/dyws/php/Installer.php';
 $installer=new \dyws\Installer(dirname($bootstrap).'/..',dyws_config_path(),dirname(__DIR__));
 if($installer->installed()){http_response_code(404);exit('Setup is unavailable.');}
 $local=in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true)&&preg_match('/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i',$_SERVER['HTTP_HOST']??'');
 $secure=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')||$local;
 $checks=$installer->checks($_SERVER['DOCUMENT_ROOT']??'',(bool)$secure);
 if(\dyws\Installer::ready($checks)){
  $installer->setupKey();
  session_name('dyws_setup');session_set_cookie_params(['httponly'=>true,'secure'=>!$local,'samesite'=>'Strict','path'=>rtrim(dirname($_SERVER['SCRIPT_NAME']),'/').'/']);session_start();
  $_SESSION['csrf']??=bin2hex(random_bytes(32));
  if($_SERVER['REQUEST_METHOD']==='POST'){
   if((int)($_SERVER['CONTENT_LENGTH']??0)>8192)throw new \dyws\ApiError('Setup form is too large.',413);
   if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf']))throw new \dyws\ApiError('This form expired. Refresh setup and try again.',403);
   if(($_POST['step']??'')==='unlock'){
    if(!is_string($_POST['key']??null)||!hash_equals($installer->setupKey(),trim($_POST['key'])))throw new \dyws\ApiError('The setup key is incorrect.',403);
    session_regenerate_id(true);$_SESSION['key']=$installer->setupKey();
   }elseif(($_POST['step']??'')==='install'){
    if(!isset($_SESSION['key']))throw new \dyws\ApiError('Enter the setup key first.',403);
    $done=$installer->install($_POST,$_SESSION['key']);$_SESSION=[];session_destroy();
   }
  }
  $step=isset($_SESSION['key'])?2:1;
 }
}catch(\dyws\ApiError $e){http_response_code($e->http);$error=$e->getMessage();$step=isset($_SESSION['key'])?2:1;}
catch(Throwable $e){http_response_code(503);error_log('dyws setup: '.$e->getMessage());$error='Setup could not continue. Check the server log and file permissions.';}
$ready=$installer&&\dyws\Installer::ready($checks)&&$checks;
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Setup | dyws</title><link rel="stylesheet" href="../dyws/dyws.css"><link rel="stylesheet" href="<?= $done?'../dyws/setup.css':'setup.css' ?>"></head>
<body class="dyws-shell dyws-setup"><header><img src="../assets/dyws.svg" width="44" height="44" alt=""><strong>dyws</strong></header><main>
<?php if($done): ?>
<h1>Ready to go</h1><p><?=esc($done['businessName'])?> is set up.</p><p><?= $done['removed']?'Setup has been removed.':'Setup is locked. Remove the remaining public_html/setup folder using your hosting file manager.' ?></p><a class="dyws-setup-link" href="../admin/">Open admin</a>
<?php else: ?>
<h1><?= $step===1?'Set up dyws':'Your business' ?></h1><p class="dyws-note">Step <?=$step?> of 2</p>
<?php if($error): ?><p class="dyws-error" role="alert"><?=esc($error)?></p><?php endif; ?>
<?php if($step===1): ?>
<ul class="dyws-checks"><?php foreach($checks as [$label,$ok,$help]): ?><li><strong><?= $ok?'✓':'!' ?> <?=esc($label)?></strong><?php if(!$ok): ?><p><?=esc($help)?></p><?php endif; ?></li><?php endforeach; ?></ul>
<?php if($ready): ?><form method="post"><input type="hidden" name="csrf" value="<?=esc($_SESSION['csrf'])?>"><input type="hidden" name="step" value="unlock"><label>Setup key<input name="key" required autocomplete="off" spellcheck="false" maxlength="48"></label><p class="dyws-note">Open <code>var/setup-key.txt</code> in your hosting file manager and copy its key here. This confirms you own the installation.</p><button>Continue</button></form><?php endif; ?>
<?php elseif($ready): ?>
<form method="post"><input type="hidden" name="csrf" value="<?=esc($_SESSION['csrf'])?>"><input type="hidden" name="step" value="install">
<label>Business name<input name="businessName" required maxlength="120" autocomplete="organization" value="<?=esc(is_string($_POST['businessName']??null)?$_POST['businessName']:'')?>"></label>
<label>Website URL<input type="url" name="baseUrl" required maxlength="240" placeholder="https://example.com/shop" value="<?=esc(is_string($_POST['baseUrl']??null)?$_POST['baseUrl']:'')?>"></label>
<label>Admin password<input type="password" name="password" required minlength="12" maxlength="72" autocomplete="new-password"></label>
<label>Confirm password<input type="password" name="confirmPassword" required minlength="12" maxlength="72" autocomplete="new-password"></label><p class="dyws-note">12 characters minimum.</p>
<label>Starting catalog<select name="catalog"><option value="empty">Empty catalog</option><option value="diner"<?=($_POST['catalog']??'')==='diner'?' selected':''?>>Starlit Diner example</option></select></label>
<button>Install dyws</button></form>
<?php endif; endif; ?>
</main></body></html>
