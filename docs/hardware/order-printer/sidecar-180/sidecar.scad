// Generated from build.py and parameters.json. Units: mm.

part="assembly"; // frame_front, frame_rear, rail_splice, sidecar_body, sidecar_lid, fit_coupon, rabbet_rail_coupon, rabbet_hook_coupon

module frame_front() { translate([0, 0, 0]) { intersection() { difference() { difference() { difference() { difference() { difference() { union() { union() { union() { union() { union() { union() { union() { difference() { translate([0, 0, 0]) { cube([160, 214, 3]); }
translate([12, 12, -1]) { cube([136, 190, 5]); } }
difference() { translate([0, 0, 0]) { cube([160, 214, 12]); }
translate([3, 3, -1]) { cube([154, 208, 14]); } } }
linear_extrude(height=12) polygon(points=[[12.0, 12.0], [36.0, 12.0], [12.0, 36.0]]); }
linear_extrude(height=12) polygon(points=[[148.0, 36.0], [124.0, 12.0], [148.0, 12.0]]); }
linear_extrude(height=12) polygon(points=[[12.0, 178.0], [36.0, 202.0], [12.0, 202.0]]); }
linear_extrude(height=12) polygon(points=[[148.0, 202.0], [124.0, 202.0], [148.0, 178.0]]); }
translate([0, 89, 0]) { cube([12, 36, 12]); } }
translate([148, 89, 0]) { cube([12, 36, 12]); } }
translate([-1, 95, 6]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=17, $fn=48); } } } }
translate([144, 95, 6]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=17, $fn=48); } } } }
translate([-1, 119, 6]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=17, $fn=48); } } } }
translate([144, 119, 6]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=17, $fn=48); } } } }
translate([152, 70, 8]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=11, $fn=48); } } } } translate([-1, 0, -1]) { cube([162, 107, 14]); } } } }
if(part=="frame_front") frame_front();

module frame_rear() { translate([0, -107, 0]) { intersection() { difference() { difference() { difference() { difference() { difference() { union() { union() { union() { union() { union() { union() { union() { difference() { translate([0, 0, 0]) { cube([160, 214, 3]); }
translate([12, 12, -1]) { cube([136, 190, 5]); } }
difference() { translate([0, 0, 0]) { cube([160, 214, 12]); }
translate([3, 3, -1]) { cube([154, 208, 14]); } } }
linear_extrude(height=12) polygon(points=[[12.0, 12.0], [36.0, 12.0], [12.0, 36.0]]); }
linear_extrude(height=12) polygon(points=[[148.0, 36.0], [124.0, 12.0], [148.0, 12.0]]); }
linear_extrude(height=12) polygon(points=[[12.0, 178.0], [36.0, 202.0], [12.0, 202.0]]); }
linear_extrude(height=12) polygon(points=[[148.0, 202.0], [124.0, 202.0], [148.0, 178.0]]); }
translate([0, 89, 0]) { cube([12, 36, 12]); } }
translate([148, 89, 0]) { cube([12, 36, 12]); } }
translate([-1, 95, 6]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=17, $fn=48); } } } }
translate([144, 95, 6]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=17, $fn=48); } } } }
translate([-1, 119, 6]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=17, $fn=48); } } } }
translate([144, 119, 6]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=17, $fn=48); } } } }
translate([152, 70, 8]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=11, $fn=48); } } } } translate([-1, 107, -1]) { cube([162, 107, 14]); } } } }
if(part=="frame_rear") frame_rear();

module rail_splice() { difference() { difference() { translate([0, 0, 0]) { cube([40, 12, 3]); }
translate([8, 6, -1]) { cylinder(d=3.4, h=5, $fn=48); } }
translate([32, 6, -1]) { cylinder(d=3.4, h=5, $fn=48); } } }
if(part=="rail_splice") rail_splice();

module sidecar_body() { translate([13, 0, 0]) { difference() { union() { union() { union() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { difference() { union() { difference() { difference() { difference() { union() { difference() { difference() { difference() { union() { difference() { difference() { difference() { union() { difference() { translate([0, 0, 0]) { cube([62, 128, 32]); }
translate([2.4, 2.4, 3]) { cube([57.2, 123.2, 32]); } }
translate([2.5, 2.5, 2.98]) { cube([9, 9, 29.02]); } }
translate([7, 7, 22]) { cylinder(d=3.4, h=15, $fn=48); } }
translate([7, 7, 24]) { rotate([0, 0, 30]) { translate([0, 0, 0]) { cylinder(d=7.043673284113434, h=2.8, $fn=6); } } } }
translate([3.95, 7, 24]) { cube([6.1, 10, 2.8]); } }
translate([2.5, 116.5, 2.98]) { cube([9, 9, 29.02]); } }
translate([7, 121, 22]) { cylinder(d=3.4, h=15, $fn=48); } }
translate([7, 121, 24]) { rotate([0, 0, 30]) { translate([0, 0, 0]) { cylinder(d=7.043673284113434, h=2.8, $fn=6); } } } }
translate([3.95, 111, 24]) { cube([6.1, 10, 2.8]); } }
translate([50.5, 2.5, 2.98]) { cube([9, 9, 29.02]); } }
translate([55, 7, 22]) { cylinder(d=3.4, h=15, $fn=48); } }
translate([55, 7, 24]) { rotate([0, 0, 30]) { translate([0, 0, 0]) { cylinder(d=7.043673284113434, h=2.8, $fn=6); } } } }
translate([51.95, 7, 24]) { cube([6.1, 10, 2.8]); } }
translate([50.5, 116.5, 2.98]) { cube([9, 9, 29.02]); } }
translate([55, 121, 22]) { cylinder(d=3.4, h=15, $fn=48); } }
translate([55, 121, 24]) { rotate([0, 0, 30]) { translate([0, 0, 0]) { cylinder(d=7.043673284113434, h=2.8, $fn=6); } } } }
translate([51.95, 111, 24]) { cube([6.1, 10, 2.8]); } }
translate([27.7, 21.7, -1]) { cylinder(d=2.3, h=5, $fn=48); } }
translate([27.7, 78.3, -1]) { cylinder(d=2.3, h=5, $fn=48); } }
translate([49.7, 21.7, -1]) { cylinder(d=2.3, h=5, $fn=48); } }
translate([49.7, 78.3, -1]) { cylinder(d=2.3, h=5, $fn=48); } }
translate([58, 96, 24]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=7.1, h=5, $fn=48); } } } }
translate([58, 60, 25]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3, h=5, $fn=48); } } } }
translate([58, 68, 25]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3, h=5, $fn=48); } } } }
translate([58, 76, 25]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3, h=5, $fn=48); } } } }
translate([16, 124, 20]) { cube([10, 5, 15]); } }
translate([36, 124, 20]) { cube([11, 5, 15]); } }
translate([18, 116, -1]) { cube([2, 4, 5]); } }
translate([28, 116, -1]) { cube([2, 4, 5]); } }
translate([34, 109, -1]) { cube([2, 4, 5]); } }
translate([46, 109, -1]) { cube([2, 4, 5]); } }
translate([21, 84, 0]) { rotate([0, 0, 90]) { translate([0, 0, 2.98]) { union() { union() { union() { union() { union() { translate([0, 0, 0]) { cube([29.4, 16.770000000000003, 2]); }
translate([0, 0, 1.98]) { cube([1.6, 14.770000000000001, 4.2]); } }
translate([27.799999999999997, 0, 1.98]) { cube([1.6, 14.770000000000001, 4.2]); } }
translate([0, 14.770000000000001, 1.98]) { cube([29.4, 2, 4.2]); } }
translate([0, 0, 4.2]) { cube([2.2, 14.770000000000001, 0.8]); } }
translate([27.2, 0, 4.2]) { cube([2.2, 14.770000000000001, 0.8]); } } } } } }
difference() { translate([-13, 12, 0]) { cube([15.4, 28, 12.4]); }
translate([-10.4, 11, -1]) { cube([3.8, 30, 10.4]); } } }
difference() { translate([-13, 88, 0]) { cube([15.4, 28, 12.4]); }
translate([-10.4, 87, -1]) { cube([3.8, 30, 10.4]); } } }
translate([-14, 27, 5]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=19, $fn=48); } } } } } }
if(part=="sidecar_body") sidecar_body();

module sidecar_lid() { difference() { difference() { difference() { difference() { translate([0, 0, 0]) { cube([62, 128, 2.4]); }
translate([7, 7, -1]) { cylinder(d=3.4, h=5, $fn=48); } }
translate([7, 121, -1]) { cylinder(d=3.4, h=5, $fn=48); } }
translate([55, 7, -1]) { cylinder(d=3.4, h=5, $fn=48); } }
translate([55, 121, -1]) { cylinder(d=3.4, h=5, $fn=48); } } }
if(part=="sidecar_lid") sidecar_lid();

module fit_coupon() { difference() { union() { difference() { difference() { difference() { union() { union() { difference() { difference() { difference() { difference() { translate([0, 0, 0]) { cube([70, 50, 2]); }
translate([4.7, 4.7, -1]) { cylinder(d=2.3, h=4, $fn=48); } }
translate([4.7, 26.7, -1]) { cylinder(d=2.3, h=4, $fn=48); } }
translate([61.3, 4.7, -1]) { cylinder(d=2.3, h=4, $fn=48); } }
translate([61.3, 26.7, -1]) { cylinder(d=2.3, h=4, $fn=48); } }
translate([3, 31, 1.98]) { union() { union() { union() { union() { union() { translate([0, 0, 0]) { cube([29.4, 16.770000000000003, 2]); }
translate([0, 0, 1.98]) { cube([1.6, 14.770000000000001, 4.2]); } }
translate([27.799999999999997, 0, 1.98]) { cube([1.6, 14.770000000000001, 4.2]); } }
translate([0, 14.770000000000001, 1.98]) { cube([29.4, 2, 4.2]); } }
translate([0, 0, 4.2]) { cube([2.2, 14.770000000000001, 0.8]); } }
translate([27.2, 0, 4.2]) { cube([2.2, 14.770000000000001, 0.8]); } } } }
translate([36, 35, 1.98]) { cube([10, 10, 12.02]); } }
translate([41, 40, -1]) { cylinder(d=3.4, h=18, $fn=48); } }
translate([41, 40, 6.8]) { rotate([0, 0, 30]) { translate([0, 0, 0]) { cylinder(d=7.043673284113434, h=2.8, $fn=6); } } } }
translate([37.95, 40, 6.8]) { cube([6.1, 10, 2.8]); } }
translate([58, 35, 1.98]) { cube([12, 2.4, 18.02]); } }
translate([64, 39, 12]) { rotate([90, 0, 0]) { translate([0, 0, 0]) { cylinder(d=7.1, h=5, $fn=48); } } } } }
if(part=="fit_coupon") fit_coupon();

module rabbet_rail_coupon() { difference() { union() { translate([0, 0, 0]) { cube([12, 32, 3]); }
translate([9, 0, 2.98]) { cube([3, 32, 9.02]); } }
translate([-1, 17, 8]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=16, $fn=48); } } } } }
if(part=="rabbet_rail_coupon") rabbet_rail_coupon();

module rabbet_hook_coupon() { difference() { difference() { translate([0, 0, 0]) { cube([15.4, 28, 12.4]); }
translate([2.6, -1, -1]) { cube([3.8, 30, 10.4]); } }
translate([-1, 15, 5]) { rotate([0, 90, 0]) { translate([0, 0, 0]) { cylinder(d=3.4, h=18, $fn=48); } } } } }
if(part=="rabbet_hook_coupon") rabbet_hook_coupon();

if(part=="assembly") {

translate([0, 0, 0]) rotate([0, 0, 0]) frame_front();

translate([0, 107, 0]) rotate([0, 0, 0]) frame_rear();

translate([12, 87, 0]) rotate([90, 0, 90]) rail_splice();

translate([145, 87, 0]) rotate([90, 0, 90]) rail_splice();

translate([154, 43, 3]) rotate([0, 0, 0]) sidecar_body();

translate([167, 43, 35]) rotate([0, 0, 0]) sidecar_lid();

}
