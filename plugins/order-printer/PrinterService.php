<?php
declare(strict_types=1);
namespace dyws\Plugins\OrderPrinter;
use dyws\{ApiError, Catalog, Store, Fulfillment};

final class PrinterService {
    public const PROFILES = [
        'dfrobot58'=>['label'=>'DFRobot DFR0503, 58 mm, manual tear', 'columns'=>32, 'cut'=>false],
        'epson80'=>['label'=>'Epson ESC/POS, 80 mm, automatic cutter', 'columns'=>48, 'cut'=>true],
    ];
    public function __construct(private array $config, private ?Store $store) {
        if (!$store) throw new ApiError('Printer storage is unavailable.',503);
        $store->db->exec(file_get_contents(__DIR__.'/schema.sql'));
    }
    private function id(string $prefix):string { return $prefix.bin2hex(random_bytes(12)); }
    private function audit(string $printer, string $action, ?string $job=null):void {
        $this->store->execute('INSERT INTO printer_audit(tenant,printer_id,job_id,action,created_at) VALUES(?,?,?,?,?)',[$this->store->tenant,$printer,$job,$action,time()]);
    }
    private function device(string $id):array {
        $rows=$this->store->query('SELECT * FROM printer_devices WHERE tenant=? AND id=?',[$this->store->tenant,$id]);
        if (!$rows) throw new ApiError('Printer not found.',404);
        return $rows[0];
    }
    private function job(string $id, string $printer):array {
        $rows=$this->store->query('SELECT * FROM printer_jobs WHERE tenant=? AND printer_id=? AND id=?',[$this->store->tenant,$printer,$id]);
        if (!$rows) throw new ApiError('Print job not found.',404);
        return $rows[0];
    }
    private function locations():array {
        $catalog=Catalog::load($this->config['catalog']);
        return array_map(fn($row)=>['id'=>$row['id'],'name'=>$row['name']],array_values(array_filter($catalog['locations']??[],fn($row)=>$row['active'])));
    }
    public function summary():array {
        $this->reconcileAll();
        $devices=$this->store->query('SELECT id,name,location_id,profile,enabled,created_at,last_seen,device_status,token_hash IS NOT NULL AS paired FROM printer_devices WHERE tenant=? ORDER BY created_at,id',[$this->store->tenant]);
        $jobs=$this->store->query('SELECT id,printer_id,order_id,kind,state,attempts,created_at,updated_at FROM printer_jobs WHERE tenant=? ORDER BY created_at DESC,id DESC LIMIT 100',[$this->store->tenant]);
        return ['devices'=>$devices,'jobs'=>$jobs,'locations'=>$this->locations(),'profiles'=>self::PROFILES,'apiBase'=>rtrim($this->config['public_base_url'],'/').'/api/','pollSeconds'=>5];
    }
    public function createDevice(array $body):array {
        $name=Store::text($body['name']??null,80);
        $location=Store::text($body['locationId']??'',80,false);
        $locations=$this->locations();
        if (($locations && !in_array($location,array_column($locations,'id'),true)) || (!$locations && $location!=='')) throw new ApiError('Choose an active business location.');
        $profile=$body['profile']??'epson80';
        if (!is_string($profile)||!isset(self::PROFILES[$profile])) throw new ApiError('Choose a supported printer profile.');
        return $this->store->transaction(function()use($name,$location,$profile){
            if (count($this->store->query('SELECT id FROM printer_devices WHERE tenant=?',[$this->store->tenant]))>=20) throw new ApiError('This pilot supports up to 20 printers.');
            $id=$this->id('PRN-');$code=bin2hex(random_bytes(16));
            $cursor=(int)$this->store->query('SELECT COALESCE(MAX(id),0) AS cursor FROM events')[0]['cursor'];
            $this->store->execute('INSERT INTO printer_devices(tenant,id,name,location_id,profile,created_at,order_cursor,enrollment_hash,enrollment_expires) VALUES(?,?,?,?,?,?,?,?,?)',[$this->store->tenant,$id,$name,$location,$profile,time(),$cursor,hash('sha256',$code),time()+1800]);
            $this->audit($id,'created');
            return ['id'=>$id,'enrollmentCode'=>$code,'expiresIn'=>1800,'apiBase'=>rtrim($this->config['public_base_url'],'/').'/api/'];
        });
    }
    public function enroll(array $body):array {
        $code=Store::text($body['code']??null,32);$token=Store::text($body['token']??null,64);$deviceId=Store::text($body['deviceId']??null,48);
        if (!preg_match('/^[a-f0-9]{32}$/D',$code)||!preg_match('/^[a-f0-9]{64}$/D',$token)||!preg_match('/^[a-zA-Z0-9_-]{8,48}$/D',$deviceId)) throw new ApiError('Invalid enrollment.',401);
        return $this->store->transaction(function()use($code,$token,$deviceId){
            $rows=$this->store->query('SELECT * FROM printer_devices WHERE tenant=? AND enrollment_hash=? AND enrollment_expires>=? AND enabled=1',[$this->store->tenant,hash('sha256',$code),time()]);
            if (!$rows) throw new ApiError('Enrollment expired or unavailable.',401);
            $device=$rows[0];$hash=hash('sha256',$token);
            if ($device['token_hash']!==null && (!hash_equals($device['token_hash'],$hash)||$device['device_id']!==$deviceId)) throw new ApiError('Printer is already paired.',409);
            $this->store->execute("UPDATE printer_devices SET token_hash=?,device_id=?,device_status='ready',last_seen=? WHERE tenant=? AND id=?",[$hash,$deviceId,time(),$this->store->tenant,$device['id']]);
            if ($device['token_hash']===null) $this->audit($device['id'],'paired');
            return ['printerId'=>$device['id'],'profile'=>$device['profile'],'pollSeconds'=>5];
        });
    }
    private function authenticated(array $headers):array {
        $token=$headers['HTTP_X_DYWS_PRINTER_TOKEN']??'';
        if (!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token)) throw new ApiError('Printer authentication required.',401);
        $rows=$this->store->query('SELECT * FROM printer_devices WHERE tenant=? AND token_hash=? AND enabled=1',[$this->store->tenant,hash('sha256',$token)]);
        if (!$rows) throw new ApiError('Printer authentication failed.',401);
        return $rows[0];
    }
    public function deviceRequest(string $action,array $body,array $headers):array {
        return $this->store->transaction(function()use($action,$body,$headers){
            $device=$this->authenticated($headers);
            return $action==='poll'?$this->poll($device,$body):$this->ack($device,$body);
        });
    }
    private function eligible(array $order):bool {
        return in_array($order['status'],['accepted','preparing','ready'],true)
            && ($order['payment_status']==='paid'||(\dyws\Store::manualPayment($order['payment_provider'])&&$order['payment_status']==='unpaid'));
    }
    private function matches(array $device,array $order):bool {
        $location=json_decode($order['order_location_json']??'{}',true);
        return ($location['id']??'')===$device['location_id'];
    }
    private static function clean(string $value):string {
        $ascii=@iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$value);
        return trim(preg_replace('/[^\x20-\x7E]/',' ', $ascii===false?$value:$ascii));
    }
    private function ticket(array $order,array $device,string $kind):string {
        $width=self::PROFILES[$device['profile']]['columns'];
        $location=json_decode($order['order_location_json']??'{}',true);
        $meta=Fulfillment::read($order);
        $lines=[$kind==='copy'?'COPY / REPRINT':'NEW ORDER','DEMONSTRATION ORDER',self::clean($location['name']??$device['name']),$order['id'],strtoupper($meta['label'])];
        if($meta['scheduled']){
            $lines[]='PICKUP DATE: '.$meta['localDate'];
            $lines[]='PICKUP TIME: '.$meta['localTime'];
            $lines[]='ZONE: '.$meta['timeZone'];
        }else $lines[]=$meta['type']==='pickup'?'AS SOON AS READY':'DELIVERY ORDER';
        $lines[]='Placed: '.gmdate('Y-m-d H:i',$order['created_at']).' UTC';
        $lines[]=self::clean($order['customer_name']);
        foreach(json_decode($order['lines_json'],true,64,JSON_THROW_ON_ERROR) as $line) {
            $lines[]=$line['quantity'].' x '.self::clean($line['name']);
            if(!empty($line['option']))$lines[]='  '.self::clean($line['option']);
        }
        if($order['notes']!==''){$lines[]='NOTES';$lines[]=self::clean($order['notes']);}
        // Kitchen tickets deliberately omit phone, address and tracking credentials.
        $lines[]='Payment: '.($order['payment_provider']==='pay-at-door'?'PAY AT THE DOOR ':($order['payment_provider']==='pay-at-restaurant'?'PAY AT RESTAURANT ':'')).($order['payment_provider']==='demo'?'TEST LEDGER ':'').strtoupper($order['payment_status']);
        if(($order['discount']??0)>0){$deal=json_decode($order['deal_json']??'{}',true);$lines[]='DEAL: '.self::clean($deal['name']??'Deal savings');$lines[]='Savings: '.$order['currency'].' '.number_format($order['discount']/100,2,'.','');}
        $lines[]='Tip: '.$order['currency'].' '.number_format(($order['tip']??0)/100,2,'.','');
        $lines[]='Total: '.$order['currency'].' '.number_format($order['total']/100,2,'.','');
        $text=implode("\n",array_map(fn($line)=>wordwrap($line,$width,"\n",true),$lines))."\n";
        if(strlen($text)>14000)throw new ApiError('Ticket is too large.',422);
        return $text;
    }
    private function enqueue(array $device,?array $order,string $kind,string $key,string $payload):string {
        $id=$this->id('JOB-');
        $this->store->execute('INSERT OR IGNORE INTO printer_jobs(tenant,id,printer_id,order_id,dedupe_key,kind,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',[$this->store->tenant,$id,$device['id'],$order['id']??null,$key,$kind,$payload,time(),time()]);
        return $this->store->query('SELECT id FROM printer_jobs WHERE tenant=? AND printer_id=? AND dedupe_key=?',[$this->store->tenant,$device['id'],$key])[0]['id'];
    }
    private function reconcile(array $device):void {
        $tenant=$this->store->tenant;$id=$device['id'];$now=time();
        $this->store->execute("UPDATE printer_jobs SET state='queued',lease_hash=NULL,lease_until=NULL,updated_at=? WHERE tenant=? AND printer_id=? AND state='leased' AND lease_until<?",[$now,$tenant,$id,$now]);
        $this->store->execute("UPDATE printer_jobs SET state='uncertain',updated_at=? WHERE tenant=? AND printer_id=? AND state='printing' AND lease_until<?",[$now,$tenant,$id,$now]);
        // Ineligible queued work is cancelled even if a status hook was missed.
        foreach($this->store->query("SELECT id,order_id FROM printer_jobs WHERE tenant=? AND printer_id=? AND state IN ('queued','leased') AND order_id IS NOT NULL",[$tenant,$id]) as $job){
            try{$valid=$this->eligible($this->store->get($job['order_id']));}catch(ApiError){$valid=false;}
            if(!$valid)$this->store->execute("UPDATE printer_jobs SET state='cancelled',updated_at=? WHERE tenant=? AND id=?",[$now,$tenant,$job['id']]);
        }
        // Only accepted orders created after pairing configuration are automatically printed.
        $orders=$this->store->query("SELECT * FROM orders WHERE tenant=? AND EXISTS (SELECT 1 FROM events e WHERE e.tenant=orders.tenant AND e.order_id=orders.id AND e.status='placed' AND e.id>?) AND status IN ('accepted','preparing','ready') AND (payment_status='paid' OR (payment_provider IN ('demo','pay-at-door','pay-at-restaurant') AND payment_status='unpaid')) AND COALESCE(json_extract(order_location_json,'$.id'),'')=? AND NOT EXISTS (SELECT 1 FROM printer_jobs j WHERE j.tenant=orders.tenant AND j.order_id=orders.id AND j.printer_id=? AND j.dedupe_key='order:'||orders.id) ORDER BY created_at,id LIMIT 200",[$tenant,$device['order_cursor'],$device['location_id'],$id]);
        foreach($orders as $order)if($this->eligible($order)&&$this->matches($device,$order))$this->enqueue($device,$order,'order','order:'.$order['id'],$this->ticket($order,$device,'order'));
    }
    public function reconcileAll():void {
        $this->store->transaction(function(){foreach($this->store->query('SELECT * FROM printer_devices WHERE tenant=? AND enabled=1 AND token_hash IS NOT NULL',[$this->store->tenant]) as $device)$this->reconcile($device);});
    }
    private function poll(array $device,array $body):array {
        $status=$body['status']??'ready';
        if(!in_array($status,['ready','paper_out','printer_unavailable','uncertain'],true))throw new ApiError('Invalid printer status.');
        return $this->store->transaction(function()use($device,$status){
            $tenant=$this->store->tenant;$id=$device['id'];$this->reconcile($device);
            $this->store->execute('UPDATE printer_devices SET last_seen=?,device_status=? WHERE tenant=? AND id=?',[time(),$status,$tenant,$id]);
            $blocked=$this->store->query("SELECT id FROM printer_jobs WHERE tenant=? AND printer_id=? AND state IN ('leased','printing','uncertain') LIMIT 1",[$tenant,$id]);
            $result=['job'=>null,'pollSeconds'=>5,'attention'=>(bool)$blocked,'profile'=>$device['profile']];
            if($status!=='ready'||$blocked)return $result;
            $jobs=$this->store->query("SELECT * FROM printer_jobs WHERE tenant=? AND printer_id=? AND state='queued' ORDER BY created_at,id LIMIT 1",[$tenant,$id]);
            if(!$jobs)return $result;
            $job=$jobs[0];$lease=bin2hex(random_bytes(24));
            $this->store->execute("UPDATE printer_jobs SET state='leased',lease_hash=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE tenant=? AND id=?",[hash('sha256',$lease),time()+90,time(),$tenant,$job['id']]);
            $result['job']=['id'=>$job['id'],'lease'=>$lease,'text'=>$job['payload'],'profile'=>$device['profile'],'cut'=>self::PROFILES[$device['profile']]['cut']];
            $result['job']['orderId']=$job['order_id'];
            $result['job']['fulfillmentMeta']=$job['order_id']?Fulfillment::read($this->store->get($job['order_id'])):null;
            return $result;
        });
    }
    private function ack(array $device,array $body):array {
        $id=Store::text($body['jobId']??null,40);$lease=Store::text($body['lease']??null,48);$action=$body['action']??null;
        if(!in_array($action,['start','sent','uncertain','release'],true))throw new ApiError('Invalid acknowledgement.');
        return $this->store->transaction(function()use($device,$id,$lease,$action){
            $job=$this->job($id,$device['id']);
            // An expired reservation that never entered printing can safely be claimed again.
            if($action==='uncertain'&&$job['state']==='queued'&&!$job['lease_hash'])return ['ok'=>true,'state'=>'queued'];
            if(!$job['lease_hash']||!hash_equals($job['lease_hash'],hash('sha256',$lease)))throw new ApiError('Print lease does not match.',409);
            $state=$job['state'];$next=$state;
            // A manager may already have resolved recovery while the device was offline.
            // A terminal acknowledgement never authorizes more physical output.
            if(in_array($action,['sent','uncertain'],true)&&in_array($state,['sent','cancelled'],true))return ['ok'=>true,'state'=>$state];
            if($action==='start'){
                if(!in_array($state,['leased','printing'],true)||$job['lease_until']<time())throw new ApiError('Print lease expired.',409);
                if($job['order_id'] && !$this->eligible($this->store->get($job['order_id'])))throw new ApiError('Order no longer eligible.',409);
                $next='printing';
            }elseif($action==='sent'){
                if(!in_array($state,['printing','uncertain','sent'],true))throw new ApiError('Job was not started.',409);
                $next='sent';
            }elseif($action==='uncertain'){
                if(!in_array($state,['leased','printing','uncertain'],true))throw new ApiError('Job cannot be marked uncertain.',409);
                $next='uncertain';
            }else{
                if($state!=='leased')throw new ApiError('Started work cannot be automatically retried.',409);
                $next='queued';
            }
            $this->store->execute('UPDATE printer_jobs SET state=?,updated_at=?,lease_until=? WHERE tenant=? AND id=?',[$next,time(),$next==='printing'?time()+180:$job['lease_until'],$this->store->tenant,$id]);
            if($action==='release')$this->store->execute('UPDATE printer_jobs SET lease_hash=NULL,lease_until=NULL WHERE tenant=? AND id=?',[$this->store->tenant,$id]);
            if($next!==$state)$this->audit($device['id'],$next,$id);
            return ['ok'=>true,'state'=>$next];
        });
    }
    public function manage(array $body):array {
        return $this->store->transaction(function()use($body){
            $device=$this->device(Store::text($body['printerId']??null,40));$action=$body['action']??null;
            if($action==='revoke'){
                $this->store->execute('UPDATE printer_devices SET enabled=0,token_hash=NULL,enrollment_expires=0 WHERE tenant=? AND id=?',[$this->store->tenant,$device['id']]);
                $this->store->execute("UPDATE printer_jobs SET state=CASE WHEN state='printing' THEN 'uncertain' ELSE 'cancelled' END,updated_at=? WHERE tenant=? AND printer_id=? AND state IN ('queued','leased','printing')",[time(),$this->store->tenant,$device['id']]);
                $this->audit($device['id'],'revoked');return ['ok'=>true];
            }
            if(!$device['enabled']||!$device['token_hash'])throw new ApiError('Pair an enabled printer first.',409);
            if($action==='test'){
                $key=Store::text($body['requestId']??null,80);
                $id=$this->enqueue($device,null,'test','test:'.$key,"DYWS PRINTER TEST\n".self::clean($device['name'])."\nConnection and alignment test\n12345678901234567890123456789012\n");
                return ['jobId'=>$id];
            }
            $job=$this->job(Store::text($body['jobId']??null,40),$device['id']);
            if(in_array($action,['resolve','dismiss'],true)&&$job['state']==='uncertain'){
                $this->store->execute('UPDATE printer_jobs SET state=?,updated_at=? WHERE tenant=? AND id=?',[$action==='resolve'?'sent':'cancelled',time(),$this->store->tenant,$job['id']]);
                $this->audit($device['id'],$action==='resolve'?'manager_confirmed':'manager_dismissed',$job['id']);return ['ok'=>true];
            }
            if($action==='reprint'){
                $key=Store::text($body['requestId']??null,80);
                $existing=$this->store->query('SELECT id FROM printer_jobs WHERE tenant=? AND printer_id=? AND dedupe_key=?',[$this->store->tenant,$device['id'],'copy:'.$job['id'].':'.$key]);
                if($existing)return ['jobId'=>$existing[0]['id']];
            }
            if($action==='reprint'&&in_array($job['state'],['sent','uncertain'],true)){
                $key=Store::text($body['requestId']??null,80);$order=$job['order_id']?$this->store->get($job['order_id']):null;
                if($order&&!$this->eligible($order))throw new ApiError('Order no longer eligible for a kitchen ticket.',409);
                $new=$this->enqueue($device,$order,'copy','copy:'.$job['id'].':'.$key,$order?$this->ticket($order,$device,'copy'):"COPY / REPRINT\n".$job['payload']);
                if($job['state']==='uncertain')$this->store->execute("UPDATE printer_jobs SET state='cancelled',updated_at=? WHERE tenant=? AND id=?",[time(),$this->store->tenant,$job['id']]);
                $this->audit($device['id'],'manager_reprint',$job['id']);return ['jobId'=>$new];
            }
            throw new ApiError('Action is unavailable for this job.',409);
        });
    }
}
