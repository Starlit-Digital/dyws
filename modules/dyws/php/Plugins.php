<?php
declare(strict_types=1);
namespace StarlitGo;

/** Plugins are trusted installed PHP code, not sandboxed or uploaded through HTTP. */
final class PluginContext {
 public array $routes=[],$actions=[],$filters=[],$activation=[],$deactivation=[];
 public function __construct(public readonly string $id,public readonly array $config,private array $aliases=[]){}
 public function route(string $method,string $path,string $access,callable $handler):void {
  if(!in_array($method,['GET','POST'],true)||!in_array($access,['public','manager','driver'],true))throw new \InvalidArgumentException('Invalid plugin route.');
  if(!str_starts_with($path,'/plugins/'.$this->id.'/')&&!str_starts_with($path,'/manager/plugins/'.$this->id.'/')&&!in_array($path,$this->aliases,true))throw new \InvalidArgumentException('Plugin routes must use their own namespace.');
  if(str_starts_with($path,'/manager/')&&$access!=='manager')throw new \InvalidArgumentException('Manager routes require manager access.');
  $key=$method.' '.$path;if(isset($this->routes[$key]))throw new \InvalidArgumentException('Duplicate plugin route.');
  $this->routes[$key]=['access'=>$access,'handler'=>$handler];
 }
 public function addAction(string $hook,callable $callback,int $priority=10):void{$this->actions[$hook][]=[$priority,$callback];}
 public function addFilter(string $hook,callable $callback,int $priority=10):void{$this->filters[$hook][]=[$priority,$callback];}
 public function onActivate(callable $callback):void{$this->activation[]=$callback;}
 public function onDeactivate(callable $callback):void{$this->deactivation[]=$callback;}
}

final class Plugins {
 private string $root,$path;private array $installed=[],$loaded=[],$errors=[],$defaults=[],$aliases=[];
 public function __construct(private array $config,?string $root=null){
  $this->root=$root??dirname(__DIR__,3).'/plugins';
  $this->path=dirname($config['database']).'/plugins-'.substr(hash('sha256',$config['tenant']),0,16).'.json';
  $bundle=$this->readJSON($this->root.'/bundled.json');$this->defaults=$bundle['active']??[];$this->aliases=$bundle['aliases']??[];
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
    $this->installed[$id]=$m;
   }catch(\Throwable $e){$this->errors[$id]='Plugin files are invalid or incompatible.';error_log('dyws plugin '.$id.': '.$e->getMessage());}
  }
 }
 private function readJSON(string $path):array{if(!is_file($path))return [];try{$value=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);return is_array($value)?$value:[];}catch(\Throwable){return [];}}
 private function state():array {
  if(!is_file($this->path))return ['active'=>array_values(array_intersect($this->defaults,array_keys($this->installed)))];
  $state=$this->readJSON($this->path);
  if(!is_array($state['active']??null)||array_filter($state['active'],fn($id)=>!is_string($id)))return ['active'=>[],'invalid'=>true];
  return ['active'=>array_values($state['active'])];
 }
 private function revision():string{return hash('sha256',is_file($this->path)?file_get_contents($this->path):json_encode($this->state()));}
 private function load(string $id):PluginContext {
  if(isset($this->loaded[$id]))return $this->loaded[$id];
  $context=new PluginContext($id,$this->config,$this->aliases[$id]??[]);
  $register=require $this->root.'/'.$id.'/'.$this->installed[$id]['entry'];
  if(!is_callable($register))throw new \RuntimeException('Plugin must return a registration function.');
  $register($context);return $this->loaded[$id]=$context;
 }
 public function boot():void {
  foreach($this->state()['active'] as $id){if(!isset($this->installed[$id])||isset($this->errors[$id]))continue;
   try{$this->load($id);}catch(\Throwable $e){$this->errors[$id]='Plugin could not start. Check the server log.';error_log('dyws plugin '.$id.': '.$e->getMessage());}
  }
 }
 public function summary():array {
  $this->boot();$state=$this->state();$plugins=[];
  foreach($this->installed as $id=>$m)$plugins[]=['id'=>$id,'name'=>$m['name'],'version'=>$m['version'],'description'=>$m['description'],'active'=>in_array($id,$state['active'],true),'error'=>$this->errors[$id]??null];
  foreach($this->errors as $id=>$error)if(!isset($this->installed[$id]))$plugins[]=['id'=>$id,'name'=>$id,'version'=>'','description'=>'','active'=>false,'error'=>$error];
  return ['plugins'=>$plugins,'revision'=>$this->revision(),'warning'=>isset($state['invalid'])?'Plugin settings could not be read. Plugins are disabled until saved again.':null];
 }
 public function publicManifest():array {
  $this->boot();$out=[];
  foreach($this->state()['active'] as $id)if(isset($this->loaded[$id])&&!isset($this->errors[$id])){
   $m=$this->installed[$id];$out[]=['id'=>$id,'version'=>$m['version'],'apiVersion'=>1,'browserModule'=>$m['browserModule']??null,'stylesheet'=>$m['stylesheet']??null];
  }
  return ['apiVersion'=>1,'plugins'=>$out];
 }
 public function save(array $body):array {
  $id=Store::text($body['id']??null,60);$active=$body['active']??null;
  if(!is_bool($active)||!isset($this->installed[$id]))throw new ApiError('Choose an installed plugin.');
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
   Catalog::write($this->path,['active'=>$state['active']]);
   return $this->summary();
  }finally{flock($lock,LOCK_UN);fclose($lock);}
 }
 public function match(string $method,string $route):?array {
  $this->boot();foreach($this->state()['active'] as $id)if(isset($this->loaded[$id])&&!isset($this->errors[$id])&&isset($this->loaded[$id]->routes[$method.' '.$route]))return $this->loaded[$id]->routes[$method.' '.$route];return null;
 }
 private function hooks(string $kind,string $name):array {
  $this->boot();$hooks=[];foreach($this->state()['active'] as $id)if(isset($this->loaded[$id])&&!isset($this->errors[$id]))foreach($this->loaded[$id]->{$kind}[$name]??[] as [$priority,$callback])$hooks[]=[$priority,$callback,$id];
  usort($hooks,fn($a,$b)=>$a[0]<=>$b[0]);return $hooks;
 }
 public function doAction(string $name,...$args):void{foreach($this->hooks('actions',$name) as [,$callback,$id])try{$callback(...$args);}catch(\Throwable $e){error_log('dyws plugin action '.$id.': '.$e->getMessage());}}
 public function applyFilters(string $name,array $value,...$args):array{foreach($this->hooks('filters',$name) as [,$callback,$id])try{$next=$callback($value,...$args);if(is_array($next))$value=$next;}catch(\Throwable $e){error_log('dyws plugin filter '.$id.': '.$e->getMessage());}return $value;}
}
