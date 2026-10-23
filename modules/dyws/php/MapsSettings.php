<?php
// Compatibility include. The implementation belongs to the bundled plugin.
require_once dirname(__DIR__,3).'/plugins/google-maps/MapsSettings.php';

if(!class_exists('dyws\\MapsSettings',false))class_alias('dyws\\Plugins\\GoogleMaps\\MapsSettings','dyws\\MapsSettings');
