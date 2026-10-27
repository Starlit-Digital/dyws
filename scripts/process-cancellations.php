<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../server/bootstrap.php';
$options=getopt('',['config:']);
[$config,$store]=dyws_bootstrap($options['config']??dyws_config_path());
$store->plugins=new \dyws\Plugins($config,$config['plugins_path']??null,$store);
$changed=\dyws\Cancellation::drain($store,50);
if($changed)(new \dyws\Realtime($config,$store))->changed(array_merge([$store->tenant.':operators'],array_map(fn($id)=>$store->tenant.':order:'.$id,$changed)));
$pending=(int)$store->query('SELECT count(*) AS n FROM cancellation_jobs WHERE tenant=?',[$store->tenant])[0]['n'];
echo json_encode(['updated'=>count($changed),'pending'=>$pending],JSON_THROW_ON_ERROR).PHP_EOL;
