<?php
declare(strict_types=1);
namespace dyws\Plugins\OrderReporting;
use dyws\{ApiError,Catalog,Store};

/** Sends only to the business address, using a host configured mail transport. */
final class ReportEmail {
 public function __construct(private Store $store,private array $config) {}
 public function availability():array {
  $catalog=Catalog::load($this->config['catalog']);$address=$catalog['businessEmail'];$mail=$this->config['report_email']??[];
  $ready=($mail['enabled']??false)===true&&filter_var($mail['from']??'',FILTER_VALIDATE_EMAIL)&&function_exists('mail');
  return ['enabled'=>(bool)($ready&&$address!==''),'recipient'=>$address,'reason'=>$address===''?'Save your business email in Settings first.':(!$ready?'Report email needs a configured sender and mail delivery on this host.':'Reports are sent only to your saved business email.')];
 }
 public function send(array $file,array $selection,string $key,?callable $transport=null):array {
  $availability=$this->availability();if(!$availability['enabled'])throw new ApiError($availability['reason'],503);
  if(!preg_match('/^[a-zA-Z0-9-]{16,80}$/D',$key))throw new ApiError('Provide a valid email request key.');
  $recipient=$availability['recipient'];$from=$this->config['report_email']['from'];
  $fingerprint=hash('sha256',json_encode([$recipient,$selection],JSON_THROW_ON_ERROR));
  $this->store->db->exec('CREATE TABLE IF NOT EXISTS report_email_requests (tenant TEXT NOT NULL,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(tenant,request_key))');
  $fresh=$this->store->transaction(function()use($key,$fingerprint){
   $this->store->execute('DELETE FROM report_email_requests WHERE tenant=? AND created_at<?',[$this->store->tenant,time()-30*86400]);
   $rows=$this->store->query('SELECT fingerprint,status FROM report_email_requests WHERE tenant=? AND request_key=?',[$this->store->tenant,$key]);
   if($rows){if(!hash_equals($rows[0]['fingerprint'],$fingerprint))throw new ApiError('This email request key belongs to a different report.',409);if($rows[0]['status']!=='accepted')throw new ApiError('This email attempt is already recorded. Check your inbox before starting another send.',409);return false;}
   $this->store->execute('INSERT INTO report_email_requests VALUES(?,?,?,?,?)',[$this->store->tenant,$key,$fingerprint,'submitting',time()]);return true;
  });
  if($fresh){
   $boundary='dyws_'.bin2hex(random_bytes(18));
   $headers=['From'=>$from,'MIME-Version'=>'1.0','Content-Type'=>'multipart/mixed; boundary="'.$boundary.'"'];
   $body='--'.$boundary."\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode('Your requested DYWS report is attached. It contains aggregate business data and no customer contact details.')).'--'.$boundary."\r\nContent-Type: ".$file['type']."\r\nContent-Disposition: attachment; filename=\"".$file['name']."\"\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode($file['content'])).'--'.$boundary."--\r\n";
   try{$accepted=($transport??static fn($to,$subject,$body,$headers)=>mail($to,$subject,$body,$headers))($recipient,'Your DYWS business report',$body,$headers);}
   catch(\Throwable $error){$accepted=false;}
   $this->store->execute('UPDATE report_email_requests SET status=? WHERE tenant=? AND request_key=?',[$accepted?'accepted':'failed',$this->store->tenant,$key]);
   if(!$accepted)throw new ApiError('The host could not submit this email. Download the report or ask the site administrator to check mail delivery.',503);
  }
  return ['accepted'=>true,'recipient'=>$recipient,'message'=>'The report was accepted by the host mail service for '.$recipient.'. Inbox delivery is not yet confirmed.'];
 }
}
