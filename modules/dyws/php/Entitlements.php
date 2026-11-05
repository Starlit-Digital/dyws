<?php
declare(strict_types=1);
namespace dyws;

/** Trusted host configuration is the seam for future verified subscription events. */
final class Entitlements {
 public static function summary(array $config):array {
  // Existing installations retain reporting until their host explicitly assigns a tier.
  // BILLING HOOK: replace this lookup with a verified tenant entitlement store later.
  // Catalog edits, browser flags and payment return URLs must never grant a capability.
  $tier=array_key_exists('pricing_tier',$config)?$config['pricing_tier']:'pro';$tier=$tier==='pro'?'pro':'free';
  return ['tier'=>$tier,'capabilities'=>['reports'=>$tier==='pro']];
 }
 public static function requireReports(array $config):void {
  if(!self::summary($config)['capabilities']['reports'])throw new ApiError('Reports are available on Pro.',403,'pro_required',['capability'=>'reports','tier'=>'free']);
 }
}
