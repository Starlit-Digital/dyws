<?php
declare(strict_types=1);
namespace dyws\Plugins\OrderReporting;
use dyws\{Store,ApiError};

/** Private immutable PDF bytes with a tenant scoped searchable generation snapshot. */
final class PdfArchive {
 private string $directory;
 public function __construct(private Store $store,array $config) {
  $this->directory=dirname($config['database']).'/report-archive/'.hash('sha256',$store->tenant);
  $store->db->exec('CREATE TABLE IF NOT EXISTS report_pdf_archive (tenant TEXT NOT NULL,id TEXT NOT NULL,reference TEXT NOT NULL,created_at TEXT NOT NULL,name TEXT NOT NULL,target TEXT NOT NULL,date_from TEXT NOT NULL,date_to TEXT NOT NULL,currency TEXT NOT NULL,fulfillment TEXT NOT NULL,snapshot TEXT NOT NULL,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(tenant,id))');
  $store->db->exec('CREATE INDEX IF NOT EXISTS report_pdf_archive_search ON report_pdf_archive(tenant,date_from,date_to,target,currency,fulfillment)');
 }
 public function save(array $file,array $data,array $sections,string $target):array {
  if($file['type']!=='application/pdf')return $file;
  if(!is_dir($this->directory)&&!mkdir($this->directory,0700,true)&&!is_dir($this->directory))throw new ApiError('PDF archive is unavailable.',503);
  $id=bin2hex(random_bytes(16));$path=$this->directory.'/'.$id.'.pdf';$temp=tempnam($this->directory,'.pending-');
  $snapshot=['rendererVersion'=>2,'target'=>$target,'sections'=>$sections,'range'=>$data['range'],'previousRange'=>$data['previousRange'],'currency'=>$data['currency'],'fulfillment'=>$data['fulfillment'],'timeZone'=>$data['timeZone'],'workingHours'=>$data['workingHours']??null,'businessInfo'=>$data['businessInfo']??[],'identity'=>$file['identity']];
  if(isset($data['mapView']))$snapshot['mapView']=$data['mapView'];
  try {
   if($temp===false||file_put_contents($temp,$file['content'],LOCK_EX)!==strlen($file['content'])||!chmod($temp,0600)||!rename($temp,$path))throw new \RuntimeException('Archive write failed');
   $this->store->execute('INSERT INTO report_pdf_archive VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[$this->store->tenant,$id,$file['identity']['reference'],$file['identity']['generatedAt'],$file['name'],$target,$data['range']['from'],$data['range']['to'],$data['currency'],$data['fulfillment'],json_encode($snapshot,JSON_THROW_ON_ERROR),hash('sha256',$file['content']),strlen($file['content'])]);
  }catch(\Throwable $error){if(is_string($temp)&&is_file($temp))unlink($temp);if(is_file($path))unlink($path);throw new ApiError('The PDF could not be archived. Try again.',503);}
  return $file+['archiveId'=>$id];
 }
 public function search(array $query):array {
  $where=['tenant=?'];$args=[$this->store->tenant];
  foreach(['target','currency','fulfillment'] as $key)if(isset($query[$key])&&is_string($query[$key])&&$query[$key]!==''){$where[]=$key.'=?';$args[]=substr($query[$key],0,80);}
  foreach(['from'=>'date_from','to'=>'date_to'] as $key=>$column)if(!empty($query[$key])){if(!is_string($query[$key])||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$query[$key]))throw new ApiError('Use YYYY-MM-DD dates.');$where[]=$column.'=?';$args[]=$query[$key];}
  if(isset($query['q'])&&is_string($query['q'])&&trim($query['q'])!==''){$where[]="(reference LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR snapshot LIKE ? ESCAPE '\\')";$term='%'.strtr(substr(trim($query['q']),0,160),['\\'=>'\\\\','%'=>'\\%','_'=>'\\_']).'%';array_push($args,$term,$term,$term);}
  $where=implode(' AND ',$where);$offset=max(0,min(100000,(int)($query['offset']??0)));$total=(int)$this->store->query('SELECT COUNT(*) AS n FROM report_pdf_archive WHERE '.$where,$args)[0]['n'];
  $rows=$this->store->query('SELECT id,reference,created_at,name,target,date_from,date_to,currency,fulfillment,snapshot,sha256,bytes FROM report_pdf_archive WHERE '.$where.' ORDER BY datetime(created_at) DESC,id DESC LIMIT 25 OFFSET '.$offset,$args);
  foreach($rows as &$row){$row['settings']=json_decode($row['snapshot'],true);unset($row['snapshot']);}unset($row);
  return ['items'=>$rows,'total'=>$total,'offset'=>$offset,'limit'=>25];
 }
 public function download(string $id):array {
  if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new ApiError('PDF not found.',404);
  $rows=$this->store->query('SELECT name,sha256 FROM report_pdf_archive WHERE tenant=? AND id=?',[$this->store->tenant,$id]);$path=$this->directory.'/'.$id.'.pdf';
  if(!$rows||!is_file($path))throw new ApiError('PDF not found.',404);
  $content=file_get_contents($path);if($content===false||!hash_equals($rows[0]['sha256'],hash('sha256',$content)))throw new ApiError('The archived PDF failed its integrity check.',503);
  return ['name'=>$rows[0]['name'],'type'=>'application/pdf','content'=>base64_encode($content),'encoding'=>'base64'];
 }
}
