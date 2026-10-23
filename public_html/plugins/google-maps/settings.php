<?php
if(!isset($dywsInlineSettings)||$dywsInlineSettings!==true){
 require __DIR__.'/../../admin/bootstrap.php';
 dyws_require_admin($config,$store);
}
?>
<section id="plugin-google-maps"><h2>Google Maps</h2><form id="maps-form"><fieldset class="dyws-editor-fields" disabled><label><input type="checkbox" name="enabled"> Enable maps</label><label>Browser API key<input name="browserKey" type="password" autocomplete="off" maxlength="200"></label><label>Map ID<input name="mapId" value="DEMO_MAP_ID" required maxlength="100"></label><details class="dyws-help"><summary>Map setup</summary><p>For testing, <a href="https://developers.google.com/maps/documentation/javascript/demo-key" target="_blank" rel="noopener noreferrer">get a Google Maps Demo Key</a>. Daily limits apply.</p><p>For a standard key, enable Maps JavaScript API and Routes API. Restrict it to <code data-dyws-site-origin>your website origin</code> and those APIs. Browser keys are visible to visitors.</p><p>Use DEMO_MAP_ID for testing. Maps are reused as locations update. Google manages tile caching; GPS is kept in memory and expires when sharing stops.</p></details><div class="dyws-actions"><button type="submit">Save</button><button id="reload-maps" type="button" class="dyws-secondary">Reload</button></div></fieldset></form><p id="maps-message" role="status"></p></section>
