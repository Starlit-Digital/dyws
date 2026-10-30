#!/usr/bin/env node
import {createIntegrationReportClient} from '../public_html/dyws/integration-reports.js';

// No key arguments, persistent credentials or report files. Pipe stdout only to
// a destination authorized to hold this tenant's private aggregate report.
const dates=process.argv.slice(2);
if(dates.length>2||dates.some(value=>!/^\d{4}-\d{2}-\d{2}$/.test(value))||!process.env.DYWS_API_URL||!process.env.DYWS_REPORT_KEY){
 console.error('Usage: node scripts/report-summary.mjs [FROM [TO]]. Set DYWS_API_URL and DYWS_REPORT_KEY in the authorized service environment.');
 process.exitCode=2;
}else{
 const controller=new AbortController();
 const stop=()=>controller.abort(new DOMException('Report cancelled.','AbortError'));
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  const reports=createIntegrationReportClient(process.env.DYWS_API_URL,{
   token:process.env.DYWS_REPORT_KEY,forcePost:process.env.DYWS_REPORT_FORCE_POST==='1',
   onMetric:event=>{if(process.env.DYWS_REPORT_METRICS==='1')console.error(JSON.stringify(event));}
  });
  const data=await reports.summary({...(dates[0]?{from:dates[0]}:{}),...(dates[1]?{to:dates[1]}:{})},{signal:controller.signal});
  console.log(JSON.stringify(data,null,2));
 }catch(error){console.error(error.name==='AbortError'?'Report cancelled.':error.message);process.exitCode=1;
 }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
