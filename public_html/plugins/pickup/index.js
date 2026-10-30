import {mountPickup} from './pickup.js';
export function register(plugin){plugin.provide('checkout.pickup',mountPickup);}
