<?php
declare(strict_types=1);
namespace StarlitGo;

/** First installation only. Runtime credentials and data never enter the web root. */
final class Installer {
 public function __construct(private string $root,public readonly string $configPath,private string $publicRoot){}
 public function installed():bool {return file_exists($this->configPath)||file_exists(dirname($this->configPath).'/installed.lock');}
 public function checks(string $documentRoot,bool $secure):array {
  $private=realpath(dirname($this->configPath));$web=realpath($documentRoot);
  $outside=$private&&$web&&$private!==$web&&!str_starts_with($private,$web.DIRECTORY_SEPARATOR);
  return [
   ['PHP 8.1 or newer',PHP_VERSION_ID>=80100,'Ask your host to enable PHP 8.1 or newer.'],
   ['SQLite',extension_loaded('pdo_sqlite'),'Enable the PHP pdo_sqlite extension.'],
   ['Encryption',extension_loaded('openssl'),'Enable the PHP openssl extension.'],
   ['Payments dependencies',extension_loaded('curl')&&extension_loaded('mbstring')&&class_exists('Stripe\\StripeClient'),'Use the install ZIP, or run composer install --no-dev. Enable curl and mbstring.'],
   ['Secure connection',$secure,'Open setup over HTTPS. HTTP is allowed only on localhost.'],
   ['Private storage',$outside,'Keep var outside the web document root. Serve only public_html.'],
   ['Writable storage',$outside&&is_writable($private),'Give the PHP process write access to the private var directory.'],
   ['Installer removal',is_writable($this->publicRoot)&&is_writable($this->publicRoot.'/setup'),'Give PHP write access to public_html and setup so it can remove setup after installation.'],
  ];
 }
 public static function ready(array $checks):bool {foreach($checks as $check)if(!$check[1])return false;return true;}
 public function setupKey():string {
  $path=dirname($this->configPath).'/setup-key.txt';
  $file=@fopen($path,'x');
  if($file){chmod($path,0600);fwrite($file,bin2hex(random_bytes(24)));fclose($file);}
  $key=trim((string)@file_get_contents($path));
  if(strlen($key)!==48)throw new ApiError('Could not prepare the setup key. Check private storage permissions.',503);
  return $key;
 }
 public function install(array $input,string $key):array {
  if($this->installed())throw new ApiError('dyws is already installed.',409);
  if(!hash_equals($this->setupKey(),$key))throw new ApiError('The setup key is incorrect.',403);
  $name=Store::text($input['businessName']??null,120);
  $password=$input['password']??null;
  if(!is_string($password)||strlen($password)<12||strlen($password)>72||str_contains($password,"\0"))throw new ApiError('Use a password between 12 and 72 bytes.');
  if($password!==($input['confirmPassword']??null))throw new ApiError('The passwords do not match.');
  $url=rtrim(Store::text($input['baseUrl']??null,240),'/');$parts=parse_url($url);
  if(!$parts||!filter_var($url,FILTER_VALIDATE_URL)||isset($parts['user'])||isset($parts['pass'])||isset($parts['query'])||isset($parts['fragment'])||str_contains($url,'\\')||preg_match('/[\x00-\x20]/',$url)||!in_array($parts['scheme']??'',['https','http'],true))throw new ApiError('Enter the full website URL, including https://.');
  if($parts['scheme']==='http'&&!in_array($parts['host'],['localhost','127.0.0.1','[::1]'],true))throw new ApiError('Use HTTPS for a public website.');
  $kind=$input['catalog']??'empty';if(!in_array($kind,['empty','diner'],true))throw new ApiError('Choose a catalog.');
  $private=dirname($this->configPath);$lock=fopen($private.'/setup.lock','c');
  if(!$lock||!flock($lock,LOCK_EX))throw new ApiError('Setup is busy. Try again.',503);
  $stage=null;$published=[];
  try{
   if($this->installed())throw new ApiError('dyws is already installed.',409);
   foreach(['orders.sqlite','catalog.json'] as $file)if(file_exists($private.'/'.$file))throw new ApiError('Existing data was found. Setup will not overwrite it.',409);
   $stage=$private.'/.install-'.bin2hex(random_bytes(8));mkdir($stage,0700);
   $catalog=$kind==='diner'?Catalog::load($this->root.'/examples/starlit-diner/catalog.json'):['schemaVersion'=>2,'businessName'=>$name,'platformName'=>'dyws','currency'=>'CAD','taxBasisPoints'=>0,'deliveryFee'=>0,'pickupAddress'=>'','categories'=>[]];
   $catalog['businessName']=$name;$catalog['platformName']='dyws';Catalog::write($stage.'/catalog.json',Catalog::validate($catalog));
   $config=['site_template'=>$kind==='diner'?'diner':'shop','public_base_url'=>$url,'tenant'=>'business-'.bin2hex(random_bytes(8)),'catalog'=>$private.'/catalog.json','database'=>$private.'/orders.sqlite','tracking_secret'=>bin2hex(random_bytes(32))];
   // Seed the administrator in SQLite; the configuration contains no account passwords.
   $seed=$config;$seed['database']=$stage.'/orders.sqlite';$seed['manager_password_hash']=password_hash($password,PASSWORD_DEFAULT);
   $GLOBALS['starlit_config']=$seed;
   $store=new Store($seed['database'],$catalog,$seed['tenant']);
   $accounts=new AdminAccounts($seed);$effective=$accounts->effective();
   if(!password_verify($password,$effective['manager_password_hash']))throw new ApiError('Could not create the administrator.',503);
   unset($accounts);$store->db->exec('PRAGMA wal_checkpoint(TRUNCATE)');unset($store);chmod($stage.'/orders.sqlite',0600);
   Catalog::write($stage.'/config.json',$config);
   foreach(['catalog.json','orders.sqlite'] as $file){if(!rename($stage.'/'.$file,$private.'/'.$file))throw new ApiError('Could not save installation files.',503);$published[]=$private.'/'.$file;}
   // The configuration is the commit point. No request can use partial installation data.
   if(!rename($stage.'/config.json',$this->configPath))throw new ApiError('Could not finish setup.',503);
   file_put_contents($private.'/installed.lock',gmdate('c')."\n");chmod($private.'/installed.lock',0600);
   @unlink($private.'/setup-key.txt');
   return ['businessName'=>$name,'removed'=>$this->removeSetup()];
  }catch(\Throwable $e){if(!is_file($this->configPath))foreach($published as $file)@unlink($file);throw $e;}
  finally{if($stage&&is_dir($stage)){foreach(glob($stage.'/*')as $file)if(is_file($file))unlink($file);rmdir($stage);}flock($lock,LOCK_UN);fclose($lock);unset($GLOBALS['starlit_config']);}
 }
 private function removeSetup():bool {
  $path=$this->publicRoot.'/setup';
  // Only remove our known installer files. Never recurse through user files or symlinks.
  if(is_link($path)||!is_dir($path))return false;
  foreach(['index.php','setup.css','.htaccess'] as $file)if(is_file($path.'/'.$file)&&!is_link($path.'/'.$file))@unlink($path.'/'.$file);
  return @rmdir($path);
 }
}
