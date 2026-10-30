<?php
declare(strict_types=1);
namespace dyws;

/** Versioned, explicitly allowed machine commands, separate from browser sessions. */
final class IntegrationApi {
 public const SCOPES=['reports:read','reports:export','keys:manage'];
 public function __construct(private Store $store,private array $config) {}
 public function serve(string $method,string $route,array $body):array {
  if(str_starts_with($route,'/manager/api-keys')){
   $session=\dyws_authorize($this->store,['manager']);
   \dyws_limit_requests($this->store,$this->config,'integration-manager',60,60);
   $actor='manager:'.$session['subject'];
   if($route==='/manager/api-keys'&&$method==='GET')return $this->listing(null,\dyws_customer_offset());
   if($route==='/manager/api-keys'&&$method==='POST')return $this->create($body,null,$actor);
   if($method==='POST'&&preg_match('~^/manager/api-keys/(key_[a-f0-9]{32})/revoke$~D',$route,$m))return $this->revoke($m[1],null,$actor);
   throw new ApiError('Endpoint not found.',404);
  }
  \dyws_limit_requests($this->store,$this->config,'integration-auth',240,60);
  $key=$this->authenticate();
  \dyws_limit_requests($this->store,$this->config,'integration-key:'.$key['id'],120,60);
  $commands=$this->commands($key);
  if($method==='GET'&&$route==='/integrations/v1/commands')return ['apiVersion'=>1,'tenant'=>$this->store->tenant,'commands'=>array_values($commands)];
  if(preg_match('~^/integrations/v1/commands/([a-z.]+)(/execute)?$~D',$route,$m)){
   $id=$m[1];
   if(!isset($commands[$id]))throw new ApiError('Command not available for this key.',403);
   if($method==='GET'&&empty($m[2]))return $commands[$id];
   if($method==='QUERY'&&($id!=='reports.summary'||!$this->queryEnabled())){
    header('Allow: POST');throw new ApiError('QUERY is not available for this command.',405);
   }
   if(in_array($method,['POST','QUERY'],true)&&($m[2]??'')==='/execute'){
    try{
     $this->validateInput($body,$commands[$id]['inputSchema']);
     $result=match($id){
      'reports.summary'=>$this->report($body),
      'reports.export'=>$this->export($body),
      'keys.list'=>$this->listing($key,$body['offset']??0),
      'keys.create'=>$this->create($body,$key,'key:'.$key['id']),
      'keys.revoke'=>$this->revoke($body['keyId'],$key,'key:'.$key['id'])
     };
     $this->audit($key['id'],'key:'.$key['id'],$id,'success');return $result;
    }catch(ApiError $e){$this->audit($key['id'],'key:'.$key['id'],$id,'denied');throw $e;}
   }
  }
  throw new ApiError('Endpoint not found.',404);
 }
 public function authenticate():array {
  $header=$_SERVER['HTTP_AUTHORIZATION']??'';
  if(!is_string($header)||!preg_match('/^Bearer (dyws_[a-f0-9]{64})$/D',$header,$m))throw new ApiError('A valid integration bearer key is required.',401);
  $rows=$this->store->query('SELECT * FROM integration_keys WHERE tenant=? AND token_hash=?',[$this->store->tenant,hash('sha256',$m[1])]);
  $key=$rows[0]??null;
  if(!$key||$key['revoked_at']!==null||(int)$key['expires_at']<=time())throw new ApiError('API key expired or revoked.',401);
  if($key['parent_id']!==null){
   $parent=$this->store->query('SELECT * FROM integration_keys WHERE tenant=? AND id=? AND revoked_at IS NULL AND expires_at>?',[$this->store->tenant,$key['parent_id'],time()]);
   if(!$parent)throw new ApiError('API key expired or revoked.',401);
  }
  $this->store->execute('UPDATE integration_keys SET last_used_at=? WHERE tenant=? AND id=?',[time(),$this->store->tenant,$key['id']]);
  $key['scopes']=json_decode($key['scopes_json'],true,16,JSON_THROW_ON_ERROR);return $key;
 }
 private function metadata(array $key):array {
  return ['id'=>$key['id'],'name'=>$key['name'],'scopes'=>json_decode($key['scopes_json'],true),'parentId'=>$key['parent_id'],'createdAt'=>(int)$key['created_at'],'expiresAt'=>(int)$key['expires_at'],'revokedAt'=>$key['revoked_at']===null?null:(int)$key['revoked_at'],'lastUsedAt'=>$key['last_used_at']===null?null:(int)$key['last_used_at']];
 }
 public function listing(?array $parent=null,int $offset=0):array {
  if($offset<0||$offset>10000000)throw new ApiError('Invalid key list offset.');
  $sql='SELECT * FROM integration_keys WHERE tenant=?';$args=[$this->store->tenant];
  if($parent){$sql.=' AND parent_id=?';$args[]=$parent['id'];}
  $sql.=' ORDER BY created_at DESC,id LIMIT 101 OFFSET ?';$args[]=$offset;$rows=$this->store->query($sql,$args);
  return ['keys'=>array_map($this->metadata(...),array_slice($rows,0,100)),'nextOffset'=>count($rows)>100?$offset+100:null,'scopes'=>$parent?array_values(array_intersect($parent['scopes'],['reports:read','reports:export'])):self::SCOPES];
 }
 public function create(array $body,?array $parent,string $actor):array {
  $name=Store::text($body['name']??null,80);
  $scopes=$body['scopes']??['reports:read'];
  if(!is_array($scopes)||!array_is_list($scopes)||!$scopes||count($scopes)>3)throw new ApiError('Choose valid scopes.');
  foreach($scopes as $scope)if(!is_string($scope)||!in_array($scope,self::SCOPES,true)||($parent&&($scope==='keys:manage'||!in_array($scope,$parent['scopes'],true))))throw new ApiError('Cannot grant the requested scope.',403);
  $expires=$body['expiresAt']??min(time()+90*86400,$parent?(int)$parent['expires_at']:PHP_INT_MAX);
  if(!is_int($expires)||$expires<=time()||$expires>time()+365*86400||($parent&&$expires>(int)$parent['expires_at']))throw new ApiError('Expiry must be in the next year and no later than the parent key.');
  return $this->store->transaction(function()use($name,$scopes,$expires,$parent,$actor){
   if($parent)$this->assertParent($parent);
   $count=$this->store->query('SELECT count(*) AS n FROM integration_keys WHERE tenant=? AND revoked_at IS NULL AND expires_at>?',[$this->store->tenant,time()])[0]['n'];
   if($count>=100)throw new ApiError('Revoke unused keys before creating more.',409);
   $id='key_'.bin2hex(random_bytes(16));$token='dyws_'.bin2hex(random_bytes(32));
   $this->store->execute('INSERT INTO integration_keys(id,tenant,token_hash,name,scopes_json,parent_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)',[$id,$this->store->tenant,hash('sha256',$token),$name,json_encode(array_values(array_unique($scopes))),$parent['id']??null,time(),$expires]);
   $this->audit($id,$actor,'key.created','success');
   $key=$this->store->query('SELECT * FROM integration_keys WHERE tenant=? AND id=?',[$this->store->tenant,$id])[0];
   return ['key'=>$this->metadata($key),'secret'=>$token,'notice'=>'Save this secret now. It will not be returned again.'];
  });
 }
 private function assertParent(array $parent):void {
  $rows=$this->store->query('SELECT * FROM integration_keys WHERE tenant=? AND id=? AND revoked_at IS NULL AND expires_at>?',[$this->store->tenant,$parent['id'],time()]);
  if(!$rows||$rows[0]['parent_id']!==null||!in_array('keys:manage',json_decode($rows[0]['scopes_json'],true),true))throw new ApiError('Key cannot manage other keys.',403);
 }
 public function revoke(string $id,?array $parent,string $actor):array {
  return $this->store->transaction(function()use($id,$parent,$actor){
   if($parent)$this->assertParent($parent);
   $rows=$this->store->query('SELECT * FROM integration_keys WHERE tenant=? AND id=?',[$this->store->tenant,$id]);
   if(!$rows||($parent&&$rows[0]['parent_id']!==$parent['id']))throw new ApiError('Key not found.',404);
   $this->store->execute('UPDATE integration_keys SET revoked_at=coalesce(revoked_at,?) WHERE tenant=? AND (id=? OR parent_id=?)',[time(),$this->store->tenant,$id,$id]);
   $this->audit($id,$actor,'key.revoked','success');return ['ok'=>true];
  });
 }
 private function audit(string $key,string $actor,string $action,string $outcome):void {
  $this->store->execute('INSERT INTO integration_audit(tenant,key_id,actor,action,outcome,created_at) VALUES(?,?,?,?,?,?)',[$this->store->tenant,$key,$actor,$action,$outcome,time()]);
  // Bound operational metadata retention. No tokens, report data or inputs are recorded.
  $this->store->execute('DELETE FROM integration_audit WHERE tenant=? AND created_at<?',[$this->store->tenant,time()-90*86400]);
 }
 private function queryEnabled():bool {return ($this->config['integration_query_enabled']??true)===true;}
 private function commands(array $key):array {
  $date=['type'=>'string','format'=>'date','description'=>'Inclusive business date, YYYY-MM-DD. Defaults to today.'];
  $filters=['from'=>$date,'to'=>$date];
  $definitions=[
   'reports.summary'=>['reports:read','Read aggregate sales, payments, tips, status counts and top items.',$filters,[]],
   'reports.export'=>['reports:export','Download an aggregate report as JSON or CSV.',$filters+['format'=>['type'=>'string','enum'=>['json','csv'],'default'=>'json']],[]],
   'keys.list'=>['keys:manage','List metadata for keys created by this provisioning key.',['offset'=>['type'=>'integer','description'=>'Pagination offset, initially zero.']],[]],
   'keys.create'=>['keys:manage','Create a service key with a subset of your report scopes.',['name'=>['type'=>'string','maxLength'=>80],'scopes'=>['type'=>'array','minItems'=>1,'items'=>['type'=>'string','enum'=>array_values(array_intersect($key['scopes'],['reports:read','reports:export']))]],'expiresAt'=>['type'=>'integer','description'=>'Unix seconds. At most parent expiry or one year.']],['name','scopes']],
   'keys.revoke'=>['keys:manage','Revoke a service key created by this provisioning key.',['keyId'=>['type'=>'string','pattern'=>'^key_[a-f0-9]{32}$']],['keyId']]
  ];$commands=[];
  foreach($definitions as $id=>[$scope,$description,$properties,$required]){
   if(!in_array($scope,$key['scopes'],true)||($scope==='keys:manage'&&$key['parent_id']!==null))continue;
   $commands[$id]=['id'=>$id,'description'=>$description,'scope'=>$scope,'method'=>'POST','route'=>'/integrations/v1/commands/'.$id.'/execute','inputSchema'=>['type'=>'object','properties'=>(object)$properties,'required'=>$required,'additionalProperties'=>false],'output'=>str_ends_with($id,'export')?'Base64 content, filename, contentType, encoding.':'JSON object','readOnly'=>!in_array($id,['keys.create','keys.revoke'],true)];
   if($id==='reports.summary')$commands[$id]['transport']=['version'=>1,'preferredMethod'=>$this->queryEnabled()?'QUERY':'POST','supportedMethods'=>$this->queryEnabled()?['QUERY','POST']:['POST'],'fallbackMethod'=>'POST'];
  }
  return $commands;
 }
 private function validateInput(array $body,array $schema):void {
  $properties=(array)$schema['properties'];
  foreach($schema['required'] as $name)if(!array_key_exists($name,$body))throw new ApiError('Missing argument: '.$name);
  foreach($body as $name=>$value){
   if(!isset($properties[$name]))throw new ApiError('Unknown argument: '.$name);
   $rule=$properties[$name];$valid=match($rule['type']){'string'=>is_string($value),'integer'=>is_int($value),'array'=>is_array($value)&&array_is_list($value),default=>false};
   if(!$valid||(isset($rule['enum'])&&!in_array($value,$rule['enum'],true))||(isset($rule['pattern'])&&!preg_match('~'.$rule['pattern'].'~D',$value)))throw new ApiError('Invalid argument: '.$name);
  }
 }
 private function report(array $body):array {
  $zone=(new Settings($this->config))->read()['timeZone'];$tz=new \DateTimeZone($zone);$today=(new \DateTimeImmutable('today',$tz))->format('Y-m-d');
  $parse=static function($value)use($tz){
   if(!is_string($value)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$value))throw new ApiError('Choose valid report dates.');
   $date=\DateTimeImmutable::createFromFormat('!Y-m-d',$value,$tz);if(!$date||$date->format('Y-m-d')!==$value)throw new ApiError('Choose valid report dates.');return $date;
  };
  $from=$parse($body['from']??$today);$to=$parse($body['to']??$from->format('Y-m-d'));
  if($to<$from||(int)$from->diff($to)->format('%a')>365)throw new ApiError('Choose a date range up to one year.');
  // Deliberately use the core aggregate, without plugin filters or order/contact records.
  return ['schemaVersion'=>1,'tenant'=>$this->store->tenant,'timeZone'=>$zone,'range'=>['from'=>$from->format('Y-m-d'),'to'=>$to->format('Y-m-d')],'moneyUnit'=>'cents','report'=>$this->store->reports($from->getTimestamp(),$to->modify('+1 day')->getTimestamp())];
 }
 private function export(array $body):array {
  $format=$body['format']??'json';$data=$this->report($body);
  if($format==='json'){$content=json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);$type='application/json';}
  else{
   $stream=fopen('php://temp','w+');
   $write=static function(array $row)use($stream){$row=array_map(static fn($v)=>is_string($v)&&preg_match('/^[\s]*[=+@\-\t\r]/u',$v)?"'".$v:$v,$row);fputcsv($stream,$row,',','"','',"\r\n");};
   $write(['tenant','from','to','timeZone','moneyUnit']);$write([$data['tenant'],$data['range']['from'],$data['range']['to'],$data['timeZone'],'cents']);
   $write(['section','metric','value']);
   foreach($data['report'] as $metric=>$value){
    if(!is_array($value))$write(['summary',$metric,$value]);
    else foreach($value as $row){$write([$metric,'record',json_encode($row,JSON_THROW_ON_ERROR)]);}
   }
   rewind($stream);$content=stream_get_contents($stream);fclose($stream);$type='text/csv;charset=utf-8';
  }
  return ['filename'=>'dyws-report-'.$data['range']['from'].'-'.$data['range']['to'].'.'.$format,'contentType'=>$type,'encoding'=>'base64','content'=>base64_encode($content)];
 }
}
