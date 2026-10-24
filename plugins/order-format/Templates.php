<?php
declare(strict_types=1);
namespace dyws\Plugins\OrderFormat;
use dyws\{Catalog,Store,ApiError};

final class Templates {
 private string $path;
 public function __construct(array $config){$this->path=dirname($config['database']).'/order-format-'.substr(hash('sha256',$config['tenant']),0,16).'.json';}
 public static function schema():array{return json_decode(file_get_contents(__DIR__.'/schema.json'),true,32,JSON_THROW_ON_ERROR);}
 private function emptyState():array{return ['templates'=>[],'assignments'=>array_fill_keys(array_keys(self::schema()),null)];}
 private function read():array{
  if(!is_file($this->path))return $this->emptyState();
  try{$data=json_decode(file_get_contents($this->path),true,64,JSON_THROW_ON_ERROR);return self::validate($data);}catch(\Throwable $e){throw new ApiError('Order templates could not be read. The built in order layouts are in use.',503);}
 }
 public function summary():array{$data=$this->read();return $data+['schema'=>self::schema(),'revision'=>Catalog::revision($data)];}
 public function layouts():array{
  try{$data=$this->read();}catch(\Throwable){return ['layouts'=>[]];}
  $templates=array_column($data['templates'],null,'id');$layouts=[];
  foreach($data['assignments'] as $stage=>$id)if($id!==null)$layouts[$stage]=$templates[$id]['layout'];
  return ['layouts'=>$layouts];
 }
 public static function validate(array $data):array{
  $schema=self::schema();$templates=$data['templates']??null;$assignments=$data['assignments']??null;
  if(!is_array($templates)||!array_is_list($templates)||count($templates)>30||!is_array($assignments))throw new ApiError('Use up to 30 templates.');
  $result=[];$ids=[];
  foreach($templates as $template){
   if(!is_array($template))throw new ApiError('Choose a valid template.');
   $id=$template['id']??null;$name=Store::text($template['name']??null,80);$stage=$template['stage']??null;
   if(!is_string($id)||!preg_match('/^[a-zA-Z0-9-]{1,64}$/D',$id)||isset($ids[$id])||!is_string($stage)||!isset($schema[$stage]))throw new ApiError('Choose a unique template and valid stage.');
   $layout=$template['layout']??null;$fields=$layout['fields']??null;$rows=$layout['rows']??null;
   if(!is_array($layout)||!is_int($rows)||$rows<1||$rows>30||!is_array($fields)||!array_is_list($fields)||count($fields)>30)throw new ApiError('Use between 1 and 30 layout rows.');
   $available=array_column($schema[$stage]['fields'],null,'id');$placed=[];$occupied=[];$clean=[];
   foreach($fields as $field){
    if(!is_array($field))throw new ApiError('Choose valid layout fields.');
    $key=$field['id']??null;$row=$field['row']??null;$column=$field['column']??null;$span=$field['span']??null;$align=$field['align']??'left';$vertical=$field['vertical']??'top';
    if(!is_string($key)||!isset($available[$key])||isset($placed[$key])||!is_int($row)||$row<1||$row>$rows||!in_array($column,[1,2],true)||!in_array($span,[1,2],true)||$column+$span>3||!in_array($align,['left','center','right'],true)||!in_array($vertical,['top','center','bottom'],true))throw new ApiError('Choose valid field positions and alignment.');
    if($key==='actions'&&$span!==2)throw new ApiError('Action buttons need both columns.');
    for($col=$column;$col<$column+$span;$col++){if(isset($occupied[$row.':'.$col]))throw new ApiError('Fields cannot overlap.');$occupied[$row.':'.$col]=true;}
    $placed[$key]=true;$clean[]=['id'=>$key,'row'=>$row,'column'=>$column,'span'=>$span,'align'=>$align,'vertical'=>$vertical];
   }
   foreach($available as $key=>$definition)if(($definition['required']??false)&&!isset($placed[$key]))throw new ApiError($definition['label'].' must stay in the '.$schema[$stage]['label'].' stage.');
   usort($clean,fn($a,$b)=>[$a['row'],$a['column']]<=>[$b['row'],$b['column']]);
   $ids[$id]=$stage;$result[]=['id'=>$id,'name'=>$name,'stage'=>$stage,'layout'=>['rows'=>$rows,'fields'=>$clean]];
  }
  $attached=[];foreach($schema as $stage=>$definition){$id=$assignments[$stage]??null;if($id!==null&&(!is_string($id)||($ids[$id]??null)!==$stage))throw new ApiError('Attach templates to their matching stage.');$attached[$stage]=$id;}
  return ['templates'=>$result,'assignments'=>$attached];
 }
 public function save(array $body):array{
  $revision=Store::text($body['revision']??null,64);$next=self::validate($body);
  $lock=fopen($this->path.'.lock','c');if(!$lock)throw new ApiError('Order templates are busy.',503);
  try{if(!flock($lock,LOCK_EX))throw new ApiError('Order templates are busy.',503);if(!hash_equals(Catalog::revision($this->read()),$revision))throw new ApiError('Templates changed in another window. Reload before saving.',409);Catalog::write($this->path,$next);return $this->summary();}
  finally{flock($lock,LOCK_UN);fclose($lock);}
 }
}
