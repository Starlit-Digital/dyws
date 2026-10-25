#pragma once
// All assets are served by the ESP32. Setup works without internet on the phone.
static const char PORTAL_HTML[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DYWS printer setup</title><style>
body{font:18px system-ui;margin:2rem auto;padding:0 1rem;max-width:36rem;background:#f8f8f5;color:#172d38}
label{display:block;margin:1rem 0}input,select,button{font:inherit;box-sizing:border-box;width:100%;min-height:48px;padding:.6rem}
button{background:#173d4d;color:white;border:0;border-radius:6px;margin:.6rem 0}small{display:block}#status{white-space:pre-wrap}
</style><h1>DYWS printer setup</h1>
<p>Enter the venue WiFi and the pairing details from DYWS. Your phone may ask you to stay connected without internet. Choose to stay connected.</p>
<form id="setup">
<label>Venue WiFi name<input name="ssid" required maxlength="32" autocomplete="off"></label>
<label>Venue WiFi password<input name="password" type="password" maxlength="63" autocomplete="new-password"><small>Leave blank only for an open venue network.</small></label>
<label>DYWS backend API address<input name="api" type="url" required maxlength="200" placeholder="https://orders.example.com/api/"></label>
<label>Pairing code<input name="code" maxlength="32" pattern="[a-f0-9]{32}" autocomplete="off"><small>Required for first setup or a different backend. Leave blank to keep an existing pairing.</small></label>
<label>Printer serial speed<select name="baud"><option>19200</option><option selected>38400</option><option>9600</option><option>57600</option><option>115200</option></select><small>Match the printer self test. Epson: 8 data bits, no parity, 1 stop bit, XON/XOFF.</small></label>
<button id="save">Connect and verify</button></form>
<p id="status" role="status" aria-live="polite">Loading setup status…</p>
<p>After success, reconnect your phone to venue WiFi and open DYWS. Hold the device setup button for 3 seconds to return here.</p>
<script>
let csrf='';const message=document.querySelector('#status'),button=document.querySelector('#save');
async function status(){try{const r=await fetch('/status',{cache:'no-store'});const s=await r.json();csrf=s.csrf;message.textContent=s.message;button.disabled=s.busy||s.done;if(s.done){document.querySelector('#setup').hidden=true;return;}if(!document.querySelector('[name=api]').value)document.querySelector('[name=api]').value=s.api||'';}catch{message.textContent='Waiting for the device. If setup succeeded, reconnect to venue WiFi. Otherwise reconnect to the device setup network.';}setTimeout(status,2500);}
document.querySelector('#setup').onsubmit=async e=>{e.preventDefault();button.disabled=true;const data=new URLSearchParams(new FormData(e.target));data.set('csrf',csrf);try{const r=await fetch('/configure',{method:'POST',body:data});const s=await r.json();message.textContent=s.message;}catch{message.textContent='Reconnecting to device…';}document.querySelector('[name=password]').value='';document.querySelector('[name=code]').value='';};status();
</script></html>)HTML";
