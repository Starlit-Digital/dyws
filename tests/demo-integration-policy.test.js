import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('Demo reporting requires owner opt in and never unlocks provisioning or unrelated commands',()=>{
 const code=`require 'modules/dyws/php/bootstrap.php';require 'plugins/demo-lockdown/DemoPolicy.php';
 foreach([false,true] as $enabled){
  $policy=new \\dyws\\Plugins\\DemoLockdown\\DemoPolicy(['demo_integration_reports'=>$enabled],null);
  foreach([
   ['GET','/integrations/v1/commands',true],
   ['GET','/integrations/v1/commands/reports.summary',true],
   ['QUERY','/integrations/v1/commands/reports.summary/execute',true],
   ['POST','/integrations/v1/commands/reports.summary/execute',true],
   ['GET','/manager/api-keys',false],['POST','/manager/api-keys',false],
   ['POST','/integrations/v1/commands/keys.create/execute',false],
   ['QUERY','/integrations/v1/commands/keys.revoke/execute',false],
   ['POST','/integrations/v1/commands/reports.export/execute',false],
   ['GET','/integrations/v1/commands/reports.export',false],
   ['GET','/unknown',false]
  ] as [$method,$route,$candidate]){
   try{$policy->request($method,$route,[]);$allowed=true;}catch(\\dyws\\ApiError $e){if($e->http!==403)throw $e;$allowed=false;}
   if($allowed!==($enabled&&$candidate))throw new Exception('Unexpected demo admission: '.$method.' '.$route);
  }
 }echo '22 demo integration admission checks passed.';`;
 const result=spawnSync('php',['-r',code],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/22 demo integration admission checks passed/);
});
