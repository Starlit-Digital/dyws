# DYWS open ring and rabbet mounted sidecar

October 28, 2026. Current mechanical design for a **180 × 180 × 180 mm printer**.

Two long rails and two end crosspieces form an open rectangular ring beneath the Epson TM-T20IV. The far rail supports the far side of the printer. Two rebated hooks built into the electronics case drop over the near rail. A retaining screw prevents the case lifting off. The printer remains in its factory housing and lifts out of the frame for service.

The centre is open. The rails use 3 mm bottom flanges and 3 mm outer vertical webs, rather than a solid plate. Triangular corner gussets support the printer contact pads and brace the corners. Solid material is concentrated at those corners, the short joining zones and the case hooks. This is a prototype design; strength and hardware fit still need physical testing.

## What to print

| Part | Quantity | Printing dimensions, mm | PLA reference, total |
| --- | ---: | --- | ---: |
| Front ring half | 1 | 160 × 107 × 12 | 39.8 g |
| Rear ring half | 1 | 160 × 107 × 12 | 39.9 g |
| Rail joining straps | 2 | 40 × 12 × 3 each | 3.4 g |
| Sidecar box with rabbet hooks | 1 | 75 × 128 × 32 | 81.5 g |
| Sidecar lid | 1 | 62 × 128 × 2.4 | 23.5 g |
| **Complete assembly, six pieces** | | | **188.1 g** |

The box itself is 62 mm wide. Its integral hooks add a 13 mm projection on the printer side. The assembled ring measures **160 × 214 mm**. Including the sidecar, the overall footprint is approximately **229 × 214 mm**, with the sidecar reaching 37.4 mm above the frame bottom. Those are assembled dimensions; every individual print fits the 180 mm machine with a 5 mm brim allowance.

The generic 3MF files contain geometry arranged on a 180 × 180 mm bed. Select your own printer and PLA profile and keep scale at 100 percent. They contain no G-code, temperatures or machine specific settings.

1. **Print first:** `plates/print_first_fit_coupons.3mf`. Includes the controller/converter/button/nut coupon and a mating pair of rail and rabbet samples. Check the actual PCB, connector and button. The hook should drop over the sample rail without force, and its retaining hole should align.
2. **Plate 01:** `plate_01_front_and_splices.3mf`, front half and both joining straps.
3. **Plate 02:** `plate_02_rear.3mf`, rear half.
4. **Plate 03:** `plate_03_sidecar_and_lid.3mf`, box and lid.

Individual STLs are in `stl/`. Print **two** copies of `rail_splice.stl`; print one of every other final part. All STLs are oriented for printing. The three coupon STLs are tests and do not become part of the finished assembly.

## PLA amount

Final geometry contains **151.692 cm³** of modelled plastic. At the reference standard PLA density of **1.24 g/cm³**, it weighs **188.1 g**, approximately half the earlier 375.4 g full cradle.

All three test pieces add approximately **19.9 g**. Including those tests and a **20 percent printing allowance**, the calculated requirement is **249.6 g**. Reserve **250 g of ordinary PLA**, or approximately **300 g** if you want more margin or use a denser formulation. Hardware and electronics are excluded.

This fills the modelled features completely; the open centre and empty electronics compartment are already excluded. It is a geometry calculation, not a slicer result. Sparse infill can reduce the amount, while brims, supports and failed prints add filament. Exact extrusion mass and time come from your slicer.

The density assumption uses the [Prusament PLA datasheet](https://prusament.com/wp-content/uploads/2022/10/PLA_Prusament_TDS_2021_10_EN.pdf). For a different PLA density, multiply 151.692 cm³ by its density. The CAD geometry is unchanged by filament selection; fit clearance can need calibration.

## Print setup

Start with a 0.4 mm nozzle, 0.20 mm layers, four perimeters and five top and bottom layers. Use solid infill for the frame halves and joining straps. About 20 percent infill is a starting point for the case and lid. Use your filament maker's PLA profile.

The large pieces print on flat bases. The hook slots need a short 3.8 mm bridge; the button bore and nut pockets also need short bridges. Inspect these on the coupons and in the slicer preview. Adjust cooling or add local support if your printer needs it. Keep the 5 mm brim within the bed and avoid an extra skirt outside that allowance.

The nominal rabbet gap is **0.4 mm per side**, with a 3.8 mm slot over the rail's 3 mm wall and 0.4 mm clearance over its top. Edit `rabbet_clearance_mm` in `parameters.json` if the coupon needs a different fit, then regenerate. Use the same clearance for the case and hook test piece. Do not scale the full assembly to correct hole or hook fit.

## Hardware

| Hardware | Quantity | Purpose |
| --- | ---: | --- |
| M3 × 18 mm button head screws | 4 | Joining straps through the reinforced rail sections |
| M3 × 20 mm button head screw | 1 | Sidecar rabbet retaining screw |
| M3 × 12 mm button head screws | 4 | Removable lid |
| M3 hex nuts | 9 | Four joining straps, one retaining screw and four captive lid nuts |
| M2 nylon standoffs, 6 mm high | 4 | FireBeetle support |
| M2 nylon screws and nuts | 4 each | Board mounting, verify stud length through the 3 mm case floor |
| Soft rubber pads, about 9.5 mm diameter and 3.175 mm high | 8 | Four beneath the frame and four between printer and frame |
| Small cable ties | 4 | Cable restraint and wire routing |

Use the previously selected DFR1139 controller, BOB-11189 converter and small COM-11996 setup button. The optional 16 mm button does not fit this design. Converter connections use insulated direct soldered pigtails rather than the earlier right angle header. No heat set inserts or adhesive attachment to the printer are needed for this frame design.

## Assembly

1. Verify the coupons first. Check board hole spacing, converter rails, button bore, M3 nut fit and the mating rabbet surfaces. Do not force a populated PCB into a tight carrier.
2. Put the ring halves together on a flat surface, with the 12 mm high outer walls facing upward. Their butt joint is at the middle of the two long rails. Fit one joining strap against the **inside vertical face** of each rail. Each strap spans the seam. Use two M3 × 18 mm screws per strap, with heads on the outside of the frame and nuts on the inside. These straps are vertical in use, although printed flat.
3. Apply the four lower rubber pads beneath the full depth corner gussets. Apply the four upper pads on top. Nominal pad centres measured from the frame's front left outside corner are (18.5,18.5), (141.5,18.5), (18.5,195.5) and (141.5,195.5), in millimetres. These positions must be checked against the received printer's actual feet and solid underside support areas. Move pads only within supported gusset material; do not cover printer vents.
4. Drop the sidecar's two hooks over the **right hand rail**, outside the frame. The case front sits 43 mm behind the ring front. The rebated grooves capture the vertical rail wall while the inner legs bear on its bottom flange.
5. Align the small retaining hole in the front hook with the rail hole. Install the M3 × 20 mm screw from the case side, with a nut on the inside of the hook. This prevents accidental lift off. Install it **before** the controller, while screwdriver access is clear. The two separate hook sections leave the central frame joint accessible.
6. Fit the controller on its four 6 mm nylon standoffs, antenna toward the case front and USB toward its rear. Mount holes, measured from the box's left wall while ignoring the hook projection, are x=27.7 and 49.7, y=21.7 and 78.3. The board spans x=26 to 51.4 and y=20 to 80.
7. Slide the converter into its carrier, using insulated soldered pigtails. Its PCB spans approximately x=6.63 to 20.6 and y=86 to 111.4, measured from the box wall. It has no mounting holes. Keep solder joints and wires clear of the slide edges.
8. Install the setup button on the outer side of the case and connect GPIO14 to GND through it. Route USB power and the short serial cable through the rear notches. Secure cable jackets with the floor tie slots. Keep wiring away from the front antenna area.
9. Slide four nuts into the internal lid posts and fit the lid using four M3 × 12 mm screws. Tighten gently. Place the printer on the upper pads and verify that it is stable, the pad contacts are sound and every control, vent and service cover remains accessible.

The nominal printer location is x=7 to 153 and y=7 to 206 within the ring, based on its 146 × 199 mm body. The frame and case hooks clear that envelope. This does not certify the received unit's exact feet, curved surfaces or underside protrusions. If the actual support areas do not match, revise the gussets or support positions before loading the assembly.

The printer is supported by the ring's padded corner gussets, with loads transferred to the lower pads. Do not lift the printer by the sidecar, lid or hooks. This prototype has not undergone a physical load test.

## Connections and clearances

The controller uses its own USB power supply and communicates with the Epson through a 3.3 V powered MAX3232 and a short RS232 cable. The printer retains its own external power supply. A single USB cable between these selected devices does not provide both functions. The phone connects to the controller's setup WiFi, after which the controller talks directly to DYWS. BLE diagnostic support remains available.

Keep both mains adapters outside. Allow approximately 70 mm behind the printer body for its DB25 hood, power plug and cable bends. The printer body is 199 mm deep; the rear ring does not enclose or force those plugs into a pocket.

The CAD includes a provisional **12 × 22 × 8 mm USB plug envelope**, in addition to the board socket projection. Verify the actual power cable plug and bends before printing the case. The board, converter PCB, plug and an internal button envelope pass collision checks. Wires, plugs, underside solder joints, exact headers and RF behaviour still need physical verification.

The sidecar holds the controller antenna away from the printer side, with its PCB approximately 40 mm outside the printer's nominal edge. Verify WiFi and BLE with the assembled printer and case.

With a 12 mm frame, 3.175 mm lower pads and 3.175 mm upper pads, the printer is raised about 18.35 mm above the counter. Its specified 268 mm open lid height then reaches about 286.35 mm. Reserve about **300 mm overhead clearance**. Confirm actual pads, feet and lid movement on the received hardware.

## Source and validation

`build.py` plus `parameters.json` are editable source. `sidecar.scad` contains the generated OpenSCAD CSG shapes. Select an individual part with the `part` variable or view the complete assembly. STL and 3MF files use the same geometry. No STEP model is included.

Regenerate with Python 3.12:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python build.py
```

`validation.json` records dimensions, masses and hashes. Checks cover closed consistently wound meshes, positive volume, one solid per STL, STL export round trips, build volume and brim clearances, arranged plate spacing, assembly collisions, nominal printer and electronics envelopes, mating rabbet samples and fastener alignment. These checks do not establish physical load capacity, reliable adhesive pads, heat performance, RF performance or slicer results.

`sidecar-preview.png` is rendered from the CAD meshes. Its wire box is the printer envelope, not a detailed model of the Epson shell. The top view shows the nominal board layout.

This package supersedes the earlier full tray enclosure for the current build. The [earlier electrical handoff](../prototype-handoff-20261024.txt) and [firmware wiring instructions](../../../../firmware/order-printer/README.md) still describe the selected controller and serial transport.
