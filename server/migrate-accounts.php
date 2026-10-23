<?php
/** CLI upgrade: snapshot SQLite, import legacy accounts, archive old credentials. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
umask(0077);require_once __DIR__.'/bootstrap.php';
$path=realpath($argv[1]??starlit_config_path());if(!$path)throw new RuntimeException('Provide an existing private configuration path.');
$config=json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);
$legacy=dirname($config['database']).'/accounts-'.substr(hash('sha256',$config['tenant']),0,16).'.json';
$lock=fopen($legacy.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Accounts are busy.');
try{
 $backup=dirname($config['database']).'/account-backups/'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(3));mkdir($backup,0700,true);
 copy($path,$backup.'/config.json');chmod($backup.'/config.json',0600);
 if(is_file($legacy)){copy($legacy,$backup.'/accounts.json');chmod($backup.'/accounts.json',0600);}
 $pdo=new PDO('sqlite:'.$config['database']);$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$pdo->exec('PRAGMA busy_timeout=5000');$pdo->exec('VACUUM INTO '.$pdo->quote($backup.'/orders.sqlite'));unset($pdo);
 $accounts=new \StarlitGo\AdminAccounts($config);$effective=$accounts->effective();
 if(!$effective['manager_password_hash'])throw new RuntimeException('No admin credential was found. The configuration was preserved.');
 unset($config['drivers'],$config['manager_password_hash']);\StarlitGo\Catalog::write($path,$config);
 if(is_file($legacy)&&!unlink($legacy))throw new RuntimeException('Import complete, but legacy credentials need manual removal. A private backup exists.');
 echo 'SQLite account migration complete. '.count($effective['drivers'])." drivers preserved. Private backup: $backup\n";
}finally{flock($lock,LOCK_UN);fclose($lock);}
