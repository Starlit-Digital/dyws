<?php
declare(strict_types=1);
namespace dyws;
require_once __DIR__.'/Features.php';
require_once __DIR__.'/Payments/Connector.php';
require_once __DIR__.'/Payments/register.php';

/** Plugins are trusted installed PHP code, not sandboxed or uploaded through HTTP. */
final class PluginContext {
 public array $routes=[],$actions=[],$filters=[],$activation=[],$deactivation=[],$paymentProviders=[],$paymentCancellations=[],$validators=[],$operations=[];
 public function __construct(public readonly string $id,public readonly array $config,private array $aliases=[],public readonly ?Store $store=null){}
 public function route(string $method,string $path,string $access,callable $handler,array $options=[]):void {
  if(!in_array($method,['GET','POST'],true)||!in_array($access,['public','manager','driver'],true))throw new \InvalidArgumentException('Invalid plugin route.');
  if(!str_starts_with($path,'/plugins/'.$this->id.'/')&&!str_starts_with($path,'/manager/plugins/'.$this->id.'/')&&!in_array($path,$this->aliases,true))throw new \InvalidArgumentException('Plugin routes must use their own namespace.');
  if(str_starts_with($path,'/manager/')&&$access!=='manager')throw new \InvalidArgumentException('Manager routes require manager access.');
  $key=$method.' '.$path;if(isset($this->routes[$key]))throw new \InvalidArgumentException('Duplicate plugin route.');
  $maxBody=$options['maxBody']??32768;if(!is_int($maxBody)||$maxBody<1||$maxBody>262144)throw new \InvalidArgumentException('Invalid body limit.');
  $this->routes[$key]=['access'=>$access,'handler'=>$handler,'maxBody'=>$maxBody,'rateLimit'=>$options['rateLimit']??null];
 }
 public function provideOperation(string $name,callable $handler):void {if(isset($this->operations[$name]))throw new \InvalidArgumentException('Duplicate business operation.');$this->operations[$name]=$handler;}
 public function providePaymentCancellation(callable $handler):void{$this->paymentCancellations[$this->id]=$handler;}
 public function providePayment(callable $provider):void{$this->paymentProviders[]=$provider;}
 public function addValidator(string $hook,callable $callback,int $priority=10):void{$this->validators[$hook][]=[$priority,$callback];}
 public function addAction(string $hook,callable $callback,int $priority=10):void{$this->actions[$hook][]=[$priority,$callback];}
 public function addFilter(string $hook,callable $callback,int $priority=10):void{$this->filters[$hook][]=[$priority,$callback];}
 public function removeAction(string $name,callable $fn):void{$this->actions[$name]=array_values(array_filter($this->actions[$name]??[],fn($entry)=>$entry[1]!==$fn));}
 public function removeFilter(string $name,callable $fn):void{$this->filters[$name]=array_values(array_filter($this->filters[$name]??[],fn($entry)=>$entry[1]!==$fn));}
 public function removeValidator(string $name,callable $fn):void{$this->validators[$name]=array_values(array_filter($this->validators[$name]??[],fn($entry)=>$entry[1]!==$fn));}
 public function onActivate(callable $callback):void{$this->activation[]=$callback;}
 public function onDeactivate(callable $callback):void{$this->deactivation[]=$callback;}
}

final class Plugins {
 private string $root,$path;private array $installed=[],$loaded=[],$errors=[],$defaults=[],$aliases=[],$retained=[],$paymentPlugins=[],$upgradeDefaults=[],$required=[];
 public function __construct(private array $config,?string $root=null,private ?Store $store=null){
  $required=$config['required_plugins']??[];
  if(!is_array($required)||!array_is_list($required)||array_filter($required,fn($id)=>!is_string($id)||!preg_match('/^[a-z][a-z0-9-]{0,59}$/D',$id)))throw new ApiError('Required plugin configuration is invalid.',503);
  $this->required=array_values(array_unique($required));
  $this->root=$root??dirname(__DIR__,3).'/plugins';
  $this->path=dirname($config['database']).'/plugins-'.substr(hash('sha256',$config['tenant']),0,16).'.json';
  $bundle=$this->readJSON($this->root.'/bundled.json');$this->defaults=$bundle['active']??[];$this->aliases=$bundle['aliases']??[];$this->retained=$bundle['retainedRoutes']??[];$this->paymentPlugins=$bundle['paymentProviders']??[];$this->upgradeDefaults=$bundle['upgradeDefaults']??[];
  foreach(glob($this->root.'/*/plugin.json')?:[] as $file){
   $id=basename(dirname($file));if(!preg_match('/^[a-z][a-z0-9-]{0,59}$/D',$id)||is_link(dirname($file))||is_link($file))continue;
   try{
    $m=json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR);
    if(($m['id']??null)!==$id||($m['apiVersion']??null)!==1)throw new \RuntimeException('Incompatible plugin manifest.');
    foreach(['name','version','description'] as $key)if(!is_string($m[$key]??null)||strlen($m[$key])>500)throw new \RuntimeException('Invalid plugin metadata.');
    foreach(['entry','browserModule','stylesheet'] as $key)if(isset($m[$key])&&!preg_match('/^[a-zA-Z0-9_-]+\.(php|js|css)$/D',$m[$key]))throw new \RuntimeException('Invalid plugin filename.');
    if(!isset($m['entry'])||!str_ends_with($m['entry'],'.php')||!is_file(dirname($file).'/'.$m['entry'])||is_link(dirname($file).'/'.$m['entry']))throw new \RuntimeException('Missing plugin entry.');
    if(isset($m['browserModule'])&&!str_ends_with($m['browserModule'],'.js'))throw new \RuntimeException('Invalid browser module.');
    if(isset($m['stylesheet'])&&!str_ends_with($m['stylesheet'],'.css'))throw new \RuntimeException('Invalid plugin stylesheet.');
    if(isset($m['settingsAnchor'])&&!preg_match('/^plugin-[a-z0-9-]+$/D',$m['settingsAnchor']))throw new \RuntimeException('Invalid settings anchor.');
    if(isset($m['capabilities'])&&(!is_array($m['capabilities'])||!array_is_list($m['capabilities'])||array_filter($m['capabilities'],fn($value)=>!is_string($value))))throw new \RuntimeException('Invalid plugin capabilities.');
    $this->installed[$id]=$m;
   }catch(\Throwable $e){$this->errors[$id]='Plugin files are invalid or incompatible.';error_log('dyws plugin '.$id.': '.$e->getMessage());}
  }
 }
 private function readJSON(string $path):array{if(!is_file($path))return [];try{$value=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);return is_array($value)?$value:[];}catch(\Throwable){return [];}}
 private function state():array {
  $state=$this->savedState();
  $state['active']=array_values(array_unique(array_merge($this->required,$state['active'])));
  return $state;
 }
 public function activeIds():array{return $this->state()['active'];}
 /** Require an installed, active and successfully loaded business capability. */
 public function requirePlugin(string $id):void {
  $this->boot();
  if(!in_array($id,$this->state()['active'],true))throw new ApiError('This business capability is unavailable.',409);
  if(!isset($this->loaded[$id])||isset($this->errors[$id]))throw new ApiError('This business capability needs attention.',503);
 }

 public function invoke(string $id,string $operation,...$args):mixed {
  $this->requirePlugin($id);$handler=$this->loaded[$id]->operations[$operation]??null;
  if(!$handler)throw new ApiError('This business operation is unavailable.',503);
  return $handler(...$args);
 }
 private function savedState():array {
  if(!is_file($this->path)){
   $defaults=$this->defaults;if(!empty($this->config['_dyws_catalogless']))$defaults=array_diff($defaults,['catalog','pickup','delivery']);
   return ['active'=>array_values(array_intersect($defaults,array_unique(array_merge(array_keys($this->installed),$this->paymentPlugins))))];
  }
  $state=$this->readJSON($this->path);
  if(!is_array($state['active']??null)||array_filter($state['active'],fn($id)=>!is_string($id)))return ['active'=>[],'invalid'=>true];
  // Adopt only explicitly listed upgrade defaults once, without undoing saved deactivations.
  $known=$state['known']??[];if(!is_array($known)||array_filter($known,fn($id)=>!is_string($id)))return ['active'=>[],'invalid'=>true];
  $introduced=array_intersect(array_diff($this->upgradeDefaults,$known),array_keys($this->installed));
  if(!empty($this->config['_dyws_catalogless']))$introduced=array_diff($introduced,['catalog','pickup','delivery']);
  return ['active'=>array_values(array_unique(array_merge($state['active'],$introduced)))];
 }
 private function revision():string{return hash('sha256',is_file($this->path)?file_get_contents($this->path):json_encode($this->state()));}
 private function load(string $id):PluginContext {
  if(isset($this->loaded[$id]))return $this->loaded[$id];
  $context=new PluginContext($id,$this->config,$this->aliases[$id]??[],$this->store);
  $register=require $this->root.'/'.$id.'/'.$this->installed[$id]['entry'];
  if(!is_callable($register))throw new \RuntimeException('Plugin must return a registration function.');
   $attributes=(new \ReflectionFunction(\Closure::fromCallable($register)))->getAttributes(Provides::class);
  if($attributes)$this->installed[$id]['provides']=$attributes[0]->newInstance()->features;
  $register($context);return $this->loaded[$id]=$context;
 }
 public function boot():void {
  foreach($this->required as $id)if(!isset($this->installed[$id])||isset($this->errors[$id]))throw new ApiError('A required installation plugin is unavailable.',503);
  foreach($this->state()['active'] as $id){if(!isset($this->installed[$id])||isset($this->errors[$id]))continue;
   try{$this->load($id);}catch(\Throwable $e){$this->errors[$id]='Plugin could not start. Check the server log.';error_log('dyws plugin '.$id.': '.$e->getMessage());}
  }
  foreach($this->required as $id)if(!isset($this->loaded[$id])||isset($this->errors[$id]))throw new ApiError('A required installation plugin could not start.',503);
 }
 public function summary():array {
  $this->boot();$state=$this->state();$plugins=[];
  foreach($this->installed as $id=>$m)$plugins[]=['id'=>$id,'name'=>$m['name'],'version'=>$m['version'],'description'=>$m['description'],'active'=>in_array($id,$state['active'],true),'error'=>$this->errors[$id]??null,'settingsAnchor'=>$m['settingsAnchor']??null,'type'=>$m['type']??'other','locked'=>in_array($id,$this->required,true),'retainsWebhooks'=>!empty($this->retained[$id])];
  foreach($this->errors as $id=>$error)if(!isset($this->installed[$id]))$plugins[]=['id'=>$id,'name'=>$id,'version'=>'','description'=>'','active'=>false,'error'=>$error];
  return ['plugins'=>$plugins,'revision'=>$this->revision(),'warning'=>isset($state['invalid'])?'Plugin settings could not be read. Plugins are disabled until saved again.':null];
 }
 public function publicManifest(?string $page=null):array {
  $this->boot();$out=[];$consumer=$page!==null?PageManifest::forPage($page):null;
  foreach($this->state()['active'] as $id)if(isset($this->loaded[$id])&&!isset($this->errors[$id])){
   $m=$this->installed[$id];if($consumer&&!PageManifest::consumes($m,$consumer['requires']))continue;$out[]=['id'=>$id,'version'=>$m['version'],'apiVersion'=>1,'browserModule'=>$m['browserModule']??null,'stylesheet'=>$m['stylesheet']??null,'capabilities'=>$m['capabilities']??[],'provides'=>$m['provides']??null];
  }
  return ['apiVersion'=>1,'page'=>$consumer['page']??null,'requires'=>$consumer['requires']??null,'plugins'=>$out,'hooks'=>$this->readJSON(__DIR__.'/hooks.json')];
 }
 public function save(array $body):array {
  $id=Store::text($body['id']??null,60);$active=$body['active']??null;
  if(!is_bool($active)||!isset($this->installed[$id]))throw new ApiError('Choose an installed plugin.');
  if(!$active&&in_array($id,$this->required,true))throw new ApiError('This plugin is required by the installation and cannot be disabled here.',403);
  $revision=Store::text($body['revision']??null,64);$lock=fopen($this->path.'.lock','c');if(!$lock)throw new ApiError('Plugin settings are busy.',503);
  try{
   if(!flock($lock,LOCK_EX))throw new ApiError('Plugin settings are busy.',503);
   if(!hash_equals($this->revision(),$revision))throw new ApiError('Plugins changed. Reload before saving.',409);
   $state=$this->state();$was=in_array($id,$state['active'],true);
   if($active!==$was){
    try{$plugin=$this->load($id);foreach($active?$plugin->activation:$plugin->deactivation as $callback)$callback();}
    catch(\Throwable $e){error_log('dyws plugin lifecycle '.$id.': '.$e->getMessage());if($active)throw new ApiError('Plugin could not activate. Check the server log.',409);}
    $state['active']=array_values(array_diff($state['active'],[$id]));if($active)$state['active'][]=$id;
   }
   $requirements=$this->readJSON($this->path)['requirements']??[];if(!is_array($requirements))$requirements=[];
   foreach($this->installed as $key=>$manifest)$requirements[$key]=$manifest['capabilities']??[];
   Catalog::write($this->path,['active'=>$state['active'],'requirements'=>$requirements,'known'=>array_values(array_unique(array_merge($this->readJSON($this->path)['known']??[],array_keys($this->installed))))]);
  }finally{flock($lock,LOCK_UN);fclose($lock);}
  if($active!==$was)$this->doAction($active?'plugin.activated':'plugin.deactivated',$id);
  return $this->summary();
 }
 /** Payment selection must fail closed, unlike optional presentation hooks. */
 public function paymentConnector(string $id):?\dyws\Payments\Connector {
  $this->boot();$connector=$this->applyFilters('payments.connector',[],$id)['connector']??null;return $connector instanceof \dyws\Payments\Connector?$connector:null;
 }
 /** Explicit money operation, separate from optional observation hooks. */
 private function cancellationHandler(string $provider):?callable {
  $this->boot();
  if(!isset($this->installed[$provider]))return null;
  // Hosts may retain settlement handlers alongside signed callbacks after deactivation.
  if(!in_array($provider,$this->state()['active'],true)&&empty($this->retained[$provider]))return null;
  try{return $this->load($provider)->paymentCancellations[$provider]??null;}catch(\Throwable){return null;}
 }
 public function supportsPaymentCancellation(string $provider):bool{return Store::manualPayment($provider)||$this->cancellationHandler($provider)!==null;}
 public function cancelPayment(string $provider,string $id):string {
  $handler=$this->cancellationHandler($provider);if(!$handler)throw new ApiError('The payment cancellation plugin is unavailable.',503);
  return $handler($id);
 }
 public function paymentProvider():string {
  if(isset($this->state()['invalid']))throw new ApiError('Plugin settings need attention before accepting orders.',503);
  $this->boot();$selected='demo';
  foreach($this->state()['active'] as $id){
   $required=in_array($id,$this->paymentPlugins,true)||in_array('payments',$this->requirements($id),true);
   if($required&&(!isset($this->loaded[$id])||isset($this->errors[$id])))throw new ApiError('The payment plugin is unavailable. Please try again later.',503);
   foreach($this->loaded[$id]->paymentProviders??[] as $provider){
    try{$value=$provider();}catch(\Throwable $e){error_log('dyws payment provider '.$id.': '.$e->getMessage());throw new ApiError('Payment settings are unavailable. Please try again later.',503);}
    if($value===null)continue;
    if(!is_string($value)||!preg_match('/^[a-z][a-z0-9-]{0,59}$/D',$value)||in_array($value,['demo','pay-at-door','pay-at-restaurant'],true)||$selected!=='demo')throw new ApiError('Check the active payment plugins.',503);
    $selected=$value;
   }
  }
  return $selected;
 }
 public function match(string $method,string $route):?array {
  $this->boot();$active=$this->state()['active'];
  foreach($this->installed as $id=>$manifest){
   $enabled=in_array($id,$active,true);
   // Only the host bundle can retain specific signed callback endpoints while inactive.
   if(!$enabled&&!in_array($method.' '.$route,$this->retained[$id]??[],true))continue;
   try{$context=$this->load($id);}catch(\Throwable $e){if(!$enabled)throw new ApiError('Payment callback unavailable. Retry later.',503);continue;}
   foreach($context->routes as $key=>$definition){
    if(!str_starts_with($key,$method.' '))continue;$path=substr($key,strlen($method)+1);
    $names=[];$pattern='';
    foreach(explode('/',$path) as $segment){
     if(preg_match('/^\{([a-zA-Z][a-zA-Z0-9]*)\}$/D',$segment,$m)){$names[]=$m[1];$pattern.='/([A-Za-z0-9_-]{1,80})';}
     else $pattern.='/'.preg_quote($segment,'~');
    }
    if(preg_match('~^'.substr($pattern,1).'$~D',$route,$matches))return $definition+['params'=>$names?array_combine($names,array_slice($matches,1)):[]];
   }
  }
  return null;
 }
 private function hooks(string $kind,string $name):array {
  $this->boot();$hooks=[];foreach($this->state()['active'] as $id)if(isset($this->loaded[$id])&&!isset($this->errors[$id]))foreach($this->loaded[$id]->{$kind}[$name]??[] as [$priority,$callback])$hooks[]=[$priority,$callback,$id];
  usort($hooks,fn($a,$b)=>$a[0]<=>$b[0]);return $hooks;
 }
 /** Validation rejects the operation; optional observation hooks never undo committed work. */
 private function requirements(string $id):array{$saved=$this->readJSON($this->path)['requirements'][$id]??[];return array_unique(array_merge(is_array($saved)?$saved:[],$this->installed[$id]['capabilities']??[]));}
 public function validate(string $name,...$args):void {
  if(isset($this->state()['invalid']))throw new ApiError('Plugin settings need attention before making changes.',503);
  $this->boot();
  foreach($this->state()['active'] as $id)if(in_array('validation',$this->requirements($id),true)&&(!isset($this->loaded[$id])||isset($this->errors[$id])))throw new ApiError('A required validation plugin is unavailable.',503);
  foreach($this->hooks('validators',$name) as [,$callback,$id]){
   try{if($callback(...$args)===false)throw new ApiError('This request was declined by a plugin.',422);}
   catch(ApiError $e){throw $e;}
   catch(\Throwable $e){error_log('dyws plugin validator '.$id.': '.$e->getMessage());throw new ApiError('A required validation could not finish. Please try again.',503);}
  }
 }
 public function removeAction(string $name,callable $callback):void{$this->removeHook('actions',$name,$callback);}
 public function removeFilter(string $name,callable $callback):void{$this->removeHook('filters',$name,$callback);}
 private function removeHook(string $kind,string $name,callable $callback):void{foreach($this->loaded as $context)$context->{$kind}[$name]=array_values(array_filter($context->{$kind}[$name]??[],fn($entry)=>$entry[1]!==$callback));}
 public function doAction(string $name,...$args):void{foreach($this->hooks('actions',$name) as [,$callback,$id])try{$callback(...$args);}catch(\Throwable $e){error_log('dyws plugin action '.$id.': '.$e->getMessage());}}
 public function applyFilters(string $name,array $value,...$args):array{foreach($this->hooks('filters',$name) as [,$callback,$id])try{$next=$callback($value,...$args);if(is_array($next))$value=$next;}catch(\Throwable $e){error_log('dyws plugin filter '.$id.': '.$e->getMessage());}return $value;}
}
