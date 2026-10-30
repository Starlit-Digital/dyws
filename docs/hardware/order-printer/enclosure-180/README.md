# DYWS enclosure for a 180 × 180 × 180 mm printer

The lighter [open ring and rabbet mounted sidecar](../sidecar-180/README.md) is now the current build. It calculates to 188.1 g PLA, with a 250 g allowance including fit pieces and waste. This file retains the earlier full cradle design for reference.

Prototype revision 1, October 28, 2026. This package contains actual CAD geometry, STL files and arranged 3MF plates. The parts fit a 180 mm build volume, including a 5 mm brim allowance. Hardware fit, slicing, strength, temperature and radio performance still require a physical prototype.

The intact Epson TM-T20IV sits in two bolted tray halves. A separate side box houses the FireBeetle controller and MAX3232. The lid opens independently, and both power supplies remain outside. The assembled footprint is **214 × 220 mm**, excluding rear cables. Allow approximately **280 mm total installation depth** and **300 mm overhead clearance**. The 180 mm limit applies to each print, not the assembled unit.

This mechanical revision supersedes the 209 × 280 mm concept and its larger printed sections in the October 24 handoff. It preserves the electrical architecture. It uses ordinary nuts instead of heat set inserts.

## Files and print order

Open the 3MF files in `plates/` using your own printer and PETG profile. These are generic geometry packages with objects arranged on a 180 × 180 mm bed. They contain no G-code, printer selection, temperatures or machine specific settings. Keep scale at 100 percent and units in millimetres. Slicers may ask whether to import geometry only; that is appropriate.

Print `print_first_fit_coupon.3mf` first. It checks the actual board hole spacing, converter slide fit, button opening in a vertical 3 mm wall, M3 clearance and nut pocket. Do not force the populated converter into a tight rail.

| Plate | Contents | Part dimensions, mm |
| --- | --- | --- |
| 01 | Front tray, one | 156 × 110 × 14 |
| 02 | Rear tray, one | 156 × 110 × 14 |
| 03 | Electronics box, one | 58 × 166 × 42 |
| 04 | Lid, four joining plates, six feet | Lid 58 × 166 × 3; plates 16 × 44 × 4; feet 16 × 16 × 8 |
| Print first | Fit coupon, one | 80 × 65 × 26 |

There are fourteen final printed pieces and one test piece. The longest part is 166 mm; with a 5 mm brim on both ends it occupies 176 mm. Every arranged object has at least 5 mm to the bed boundary and at least 10 mm to another object's bounding rectangle.

Individual STL files are also supplied in `stl/`. Print one of each tray, box and lid, **four copies** of `join_plate.stl` and **six copies** of `foot.stl`. Each STL is already oriented for printing. Feet print with nut recesses facing upward and are turned over during assembly.

## Print settings and material

Start with PETG, a 0.4 mm nozzle, 0.20 mm layers, four perimeters, five top and bottom layers and about 20 percent infill. Use the filament maker's temperature profile and inspect the slicer preview. Print the joining plates and feet solid if the slicer does not already fill them. Keep the 5 mm brim within the bed; disable an extra skirt outside that allowance.

The large parts have flat bases. Small horizontal button and ventilation holes, nut pocket roofs and converter retaining lips need short bridges. Check these on the coupon before deciding whether local support or minor hole cleanup is required. Do not fill the rail channels or nut entries with inaccessible support material.

The final geometry contains about **302.72 cm³** of plastic if fully solid, or **384.5 g** at the assumed PETG density of 1.27 g/cm³. This is a geometry calculation, not a slicer result. Reserve about **0.5 kg** including the coupon and normal waste. Actual infill, extrusion width, supports and retries change consumption. Print time must come from your slicer.

For **standard PLA at 1.24 g/cm³**, the complete enclosure is approximately **375.4 g**, plus **31.8 g** for the fit coupon. Including a 20 percent allowance gives **488.7 g**, so reserve **500 g**. Some matte formulations are denser and need closer to 550 g. See the [PLA material estimate](PLA-MATERIAL-ESTIMATE.txt) for the part breakdown, common PLA types, manufacturer density examples and calculation limits. These are geometry based estimates; use the actual PLA profile when slicing.

## Hardware changes from the earlier parts list

| Hardware | Quantity | Use |
| --- | ---: | --- |
| M3 × 12 mm button head machine screws | 18 | Eight joining plate screws, six feet, four lid screws |
| M3 hex nuts, nominal 5.5 mm across flats | 18 | Eight exposed under joining plates, six captured in feet, four in lid posts |
| M2 nylon standoffs, 6 mm high | 4 | Controller support |
| M2 nylon screws and nuts | 4 each | Controller attachment, verify the standoff's stud length through the 4 mm floor |
| Rubber pads, about 9.5 mm diameter and 3.175 mm high | 10 | Six beneath feet, four beneath printer contact points; buy three packs of four |
| Small cable ties | 4 | Two cable restraints and wiring management |

The former M3 × 8 mm case screws and heat set inserts are not used. Buy button heads low enough to clear the printer's upper rubber pads. The 12 mm length is measured under the head. Check actual nut fit before full printing; the model uses a 6.1 mm pocket across flats and 2.8 mm pocket height.

Use the original small COM-11996 setup button, approximately 6.75 mm threaded diameter, in the 7.1 mm bore. The optional larger 16 mm button from the consolidated purchasing list does not fit this revision.

Use **direct soldered, insulated pigtails on the MAX3232**, rather than the previously listed right angle header. This keeps its header edge inside the available routing space. The controller can retain its normal headers. The converter rails grip its short edges and leave the signal pad edge accessible. Verify that the actual PCB thickness, underside joints and components clear the rails.

The earlier C$380.06 basket is a dated purchasing reference. Its hardware quantities and total must be reconciled with these changes before ordering.

## Assembly

1. Check the coupon with the actual board, converter, button and nuts. If necessary, adjust the clearances in `parameters.json`, regenerate and print another coupon. Never scale the entire model to correct a hole fit.
2. Place the front and rear trays together on a flat surface. The front tray has the low front lip; the rear edge is open. Fit two joining plates underneath the centre seam, using four M3 screws and nuts. The plates span the seam along the printer depth.
3. Put the electronics box on the right, with its front face 32 mm behind the tray front. Fit the other two joining plates underneath, across the tray to box joint, using four M3 screws and nuts. Do not glue the tray to the printer.
4. Insert nuts into all six printed feet. Turn the feet so the pockets face the counter and attach them underneath using six M3 screws. Four feet support the tray corners; two support the outside of the electronics box. Apply rubber pads beneath all six feet after confirming screw ends do not protrude past the feet.
5. Mount the controller on four 6 mm nylon standoffs. Put its antenna toward the box front and USB connector toward the rear. In the box's local coordinates, its PCB spans x=23 to 48.4 and y=46 to 106. Hole centres are x=24.7 and 46.7, y=47.7 and 104.3. Keep wiring away from the antenna end.
6. Solder and insulate the converter pigtails, then slide the converter into its rails from the open edge. It lies beside the USB cable route, with the PCB approximately x=7.63 to 21.6 and y=123 to 148.4. Do not drill through the converter or allow solder joints to rub its carrier.
7. Install the setup button in the front face and connect GPIO14 to GND through it. Follow the existing firmware wiring instructions for 3.3 V converter power and serial TX/RX. The rear notches accept captive USB and serial cables while the lid is removed. Secure cable jackets using the floor slots and cable ties.
8. Slide four nuts into the horizontal entries beneath the lid posts. Fit the lid with four M3 screws. Keep loose wire below the lid and away from screw ends. Tighten gently into PETG.
9. Place four upper rubber pads under verified support areas of the printer, avoiding vents, screws and the printed screw heads. Position the printer within the 150 mm clear tray width. Check roll loading, release grips, cutter cover, top controls and full lid opening. The printer lifts out for servicing.

Lift the assembly from underneath the printer cradle. The side box and lid are not carrying handles. This design is for a dry indoor counter and does not establish a spill or ingress rating.

## Dimensions and cable allowances

The manufacturer printer envelope is 146 × 199 × 146 mm. The model places it 5 mm from the left outside edge and 7 mm from the front, giving 2 mm side clearance inside the walls. Its location and four soft support points must be checked against the received printer.

The open rear does not force the 56.3 mm wide DB25 hood into a narrow passage. Reserve roughly 70 mm behind the printer body for the serial connector, power plug and cable bends. This is installation space, not a printed rear tray.

The electronics model allows a **12 × 22 × 8 mm USB plug envelope**, beyond the board's 1.47 mm socket projection. This is a design allowance. Measure the captive power supply plug and cable bend before printing the box. The generated checks cover the nominal board bodies and plug envelope; they do not model every solder joint, lead or cable bend.

With 8 mm printed feet, 3.175 mm lower pads, a 4 mm floor and 3.175 mm upper pads, the printer is raised about 18.35 mm. Its specified 268 mm open lid height therefore reaches about 286.35 mm above the counter. Keep the planned 300 mm overhead space and check the received printer.

## Source and verification

`build.py` and `parameters.json` are editable source. `enclosure.scad` is a generated CSG model that can be opened in OpenSCAD; select a part with the `part` variable, or view the complete assembly. The Python source exports exactly the same shapes to STL. No STEP file or proprietary CAD model is claimed.

To regenerate using Python 3.12:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python build.py
```

`validation.json` records dimensions, quantities, hashes and checks. Generation verifies closed meshes with consistent face winding, one connected solid per part, positive volume, STL round trips, bed and brim clearance, arranged plate spacing, joining hole alignment, absence of solid assembly collisions, the printer envelope and nominal electronics clearances. This does not replace a slicer preview, a physical coupon, load testing or a hardware fit test.

The image in `cad-preview.png` is generated from these meshes. The wire box represents the printer's dimensions; it is not an accurate model of its outside surfaces.

References: [Epson TM-T20IV technical guide](https://files.support.epson.com/pdf/pos/bulk/tm-t20iv_trg_en_rev_c.pdf), [DFRobot controller drawing](https://dfimg.dfrobot.com/wiki/20495/DFR1139_firebeetle-2-esp32-e-n16r8_dimension_v1.0.pdf), [SparkFun converter CAD](https://raw.githubusercontent.com/sparkfun/MAX3232_Breakout/master/Hardware/SparkFun_MAX3232_Breakout.brd). Electrical architecture and Canadian purchasing sources remain in the [earlier handoff](../prototype-handoff-20261024.txt) and [parts research](../../../order-printer-canadian-parts-research-20261024.md).
