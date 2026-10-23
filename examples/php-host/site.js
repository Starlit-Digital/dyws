import {mountStorefront,createAPIClient} from './assets/dyws/index.js';
mountStorefront({
 ordering:document.querySelector('dyws-ordering'),
 container:[...document.querySelectorAll('[data-dyws-rendered]')],
 api:createAPIClient(new URL('./api.php',import.meta.url)),
 hydrate:true,
 tracking:{container:document.querySelector('main'),storageKey:'dyws-example-tracking'}
});
