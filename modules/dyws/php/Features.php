<?php
declare(strict_types=1);
namespace dyws;

/** Browser features are names, never PHP paths, class names or URLs from a request. */
final class FeatureNames {
 public static function validate(array $names):array {
  if(!array_is_list($names)||array_filter($names,fn($name)=>!is_string($name)||!preg_match('/^[a-z][a-z0-9_.:-]{0,99}$/D',$name)))throw new \InvalidArgumentException('Invalid feature declaration.');
  return array_values(array_unique($names));
 }
}
#[\Attribute(\Attribute::TARGET_FUNCTION)]
final class Provides {
 public readonly array $features;
 public function __construct(string ...$features){$this->features=FeatureNames::validate($features);}
}
#[\Attribute(\Attribute::TARGET_METHOD)]
final class Requires {
 public readonly array $features;
 public function __construct(string ...$features){$this->features=FeatureNames::validate($features);}
}
/** Explicit page consumers. Unknown page names never select code from the filesystem. */
final class PageManifest {
 #[Requires('catalog:item','cart:updated','checkout:fields','checkout:validating','order.layout','pickup.map','checkout.pickup')]
 public static function storefront():void {}
 #[Requires('admin:navigation','admin:tables','admin:order','location.renderer')]
 public static function orders():void {}
 #[Requires('admin:navigation','reports.renderer','reports:query','reports:export','reports:metrics','admin:report-controls','admin:dashboard','admin:tables')]
 public static function reports():void {}
 #[Requires('admin:navigation')]
 public static function catalog():void {}
 #[Requires('admin:navigation','location.renderer')]
 public static function drivers():void {}
 #[Requires('admin:navigation')]
 public static function password():void {}
 #[Requires('admin:navigation','admin:settings')]
 public static function settings():void {}
 #[Requires('admin:navigation')]
 public static function plugins():void {}
 #[Requires('location.renderer','driver:orders')]
 public static function driver():void {}
 #[Requires('location.renderer','payment.renderer','tracking:updated')]
 public static function tracking():void {}
 #[Requires()]
 public static function auth():void {}
 #[Requires()]
 public static function admin():void {}
 #[Requires()]
 public static function setup():void {}
 public static function forPage(string $page):array {
  if(!method_exists(self::class,$page))throw new \InvalidArgumentException('Unknown page.');
  $attributes=(new \ReflectionMethod(self::class,$page))->getAttributes(Requires::class);
  if(count($attributes)!==1)throw new \InvalidArgumentException('Page has no Requires declaration.');
  return ['page'=>$page,'requires'=>$attributes[0]->newInstance()->features];
 }
 public static function consumes(array $plugin,array $requires):bool {
  // Undeclared third party plugins retain all-page behavior. Validators are never optimized away.
  return !isset($plugin['provides'])||in_array('validation',$plugin['capabilities']??[],true)||count(array_intersect($requires,$plugin['provides']))>0;
 }
}
