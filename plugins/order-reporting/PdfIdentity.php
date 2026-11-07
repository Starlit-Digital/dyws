<?php
declare(strict_types=1);
namespace dyws\Plugins\OrderReporting;

final class PdfIdentity {
 public static function header(array $data,string $business):string {
  $info=$data['businessInfo']??[];$lines=[$business];
  foreach(['pickupAddress','businessPhone','businessEmail','businessWebsite'] as $key)if(trim((string)($info[$key]??''))!=='')$lines[]=$info[$key];
  return '<p style="font-size:10px;line-height:1.5">'.implode('<br>',array_map(fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'),$lines)).'</p>';
 }
 public static function notes(array $data):string {
  return (($data['demo']??false)?'Demonstration records. No real payments. ':'').'Orders use creation dates; payments and refunds use event dates. Cancelled orders are excluded from item and ordered value metrics, but included in demand. Operational information, not audited accounts. Reconcile with payment and accounting records.';
 }
 public static function prefix(string $business):string {return trim(strtolower(preg_replace('/[^a-zA-Z0-9]+/','-',$business)),'-')?:'dyws';}
 public static function footer(\Dompdf\Dompdf $pdf,string $zone):array {
  $alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';$reference='';for($i=0;$i<16;$i++)$reference.=$alphabet[random_int(0,35)];
  $now=new \DateTimeImmutable('now',new \DateTimeZone('UTC'));$stamp=$now->format('Y-m-d H:i:s T').' · '.$reference;
  $font=$pdf->getFontMetrics()->getFont('DejaVu Sans','normal');$metrics=$pdf->getFontMetrics();
  $pdf->getCanvas()->page_script(static function($page,$pages,$canvas)use($stamp,$font,$metrics):void {
   $text=$stamp.' · '.$page.' / '.$pages;$size=8;$width=$metrics->getTextWidth($text,$font,$size);
   $canvas->text(($canvas->get_width()-$width)/2,$canvas->get_height()-25,$text,$font,$size,[.30,.36,.33]);
  });
  return ['reference'=>$reference,'generatedAt'=>$now->format('c')];
 }
}
