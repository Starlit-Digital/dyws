"""Prepare native Google Docs content blocks from the current project references."""
from pathlib import Path
import json,re

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
LINKS=json.loads((HERE/'cloud-links.json').read_text())
HARDWARE=ROOT/'docs/hardware/order-printer'

master='''# DYWS Order Printer
Current design and build handoff, 28 October 2026

## Current decision
Build one Epson TM-T20IV C31CL47001 prototype with a DFRobot FireBeetle 2 ESP32-E N16R2 controller, SKU DFR1139. Use the Arduino framework, the controller's own protected WiFi for phone setup, and direct HTTPS communication with the DYWS backend. Retain BLE diagnostic support.

The mechanical design is an open rectangular ring beneath the printer with a small sidecar on one rail. Two built in rabbets hook the case over that rail. A retaining screw secures it. The ring has two long rails, two end crosspieces, an open centre and corner gussets. This is the current design; the earlier full cradle is historical.

All six final printed pieces fit a 180 × 180 × 180 mm machine, including a 5 mm brim allowance. The completed ring and sidecar calculate to **188.1 g of standard PLA**. Reserve **250 g** including fit tests and a 20 percent printing allowance. The figures come from CAD volume, not a slicer or a measured print.

## Project files
[DYWS folder](FOLDER_URL)
[Current printable package, STL, 3MF and editable source](PRINT_URL)
[Current CAD preview](PREVIEW_URL)
[Canadian parts research and purchase links](PARTS_URL)
[Software and technical reference](TECH_URL)
[Printer software source, research and previous designs](REFERENCE_URL)

Use the current printable package for the ring and rabbet mounted sidecar. Its three final print plates and separate test plate replace the earlier full tray layout. The reference archive preserves previous designs and contains the printer firmware, optional plugin and related tests. It excludes live configuration and databases. The printer source requires the existing DYWS framework.

## Selected hardware and verified dimensions
| Component | Selected model | Relevant specification |
| --- | --- | --- |
| Printer | Epson TM-T20IV C31CL47001 | 146 W × 199 D × 146 H mm; USB and RS232 model; DB25 female serial socket |
| Controller | FireBeetle 2 ESP32-E N16R2, DFR1139 | PCB 60 × 25.4 mm; 61.47 mm including USB projection; documented height 6.62 mm before added headers |
| Controller mounting | Four M2 holes | Centres 56.6 × 22 mm; use nylon standoffs, not M3 screws |
| Serial converter | SparkFun MAX3232, BOB-11189 | PCB 25.4 × 13.97 mm; no mounting holes; insulating slide carrier |
| Serial plug and hood | Assmann A-DS25LL/Z and A-FT 25 | DB25 male solder cups; hood 56.3 × 36.5 × 14.8 mm; 4-40 mating screws |
| Controller supply | Official Raspberry Pi USB-C, US version | Fixed 5.1 V, 3 A capacity, captive USB-C lead |
| Printer supply | Epson AC adapter C1 or equivalent | Separate specified external printer supply; confirm the regional carton includes adapter and AC lead |

The printer accepts nominal 80 mm thermal receipt paper, with specified width 79.5 ± 0.5 mm and maximum roll diameter 83 mm. It has a partial cutter, 203 dpi resolution and a maximum stated speed of 250 mm/s. Its top right controls, lid, cutter cover, release grips and paper exit must stay accessible. The lid reaches 268 mm above the printer base when fully open. Allow about 300 mm above the counter with the proposed frame and pads.

The ESP32 has 16 MB flash and 2 MB PSRAM, 2.4 GHz WiFi and Bluetooth hardware. It is the small computer in this assembly; no additional Arduino Uno, full size computer, battery or separate radio module is required.

## Power and serial connection
The selected printer USB port and selected controller do not provide a single cable path for both control and power. Use a short serial data cable through the MAX3232 and two separate power supplies. Both mains adapters stay outside the printed enclosure.

USB supply → controller USB-C.
Controller UART → MAX3232 → short DB25 serial cable → Epson printer.
Epson adapter → printer power input.

| Controller connection | Converter connection | Printer connection |
| --- | --- | --- |
| 3V3 | VCC | None |
| GND | GND | DB25 pin 7, signal ground |
| GPIO25, UART TX | T1IN, then T1OUT | DB25 pin 3, printer RX |
| GPIO26, UART RX | R1OUT, from R1IN | DB25 pin 2, printer TX |
| GPIO14 and GND | Normally open setup button | None |

Power the converter at 3.3 V. Do not connect RS232 directly to ESP32 pins or connect printer 24 V to the controller. Use the actual silkscreen and moulded connector numbers, and check cable continuity before power. A USB serial dongle is a different device. Avoid GPIO16 and GPIO17 on this PSRAM board.

Configure Epson serial for 38400 baud, 8 data bits, no parity, one stop bit and XON/XOFF. Match the firmware to the printer self test. Both TX and RX are required for status and flow control. The purchased USB and serial variant uses DB25 female; other variants can have different serial connectors.

## Initial setup and daily operation
1. In a private DYWS pilot, enable Order Printer, select the venue location and Epson profile, and create a pairing code.
2. Flash the firmware over USB. Read the unique DYWS setup network name and password from the serial monitor. Put these setup credentials on the device label.
3. Join that protected WiFi network from the phone. Open http://192.168.4.1 if setup does not open automatically. Keep the connection if the phone warns that it has no internet.
4. Enter the venue's 2.4 GHz WiFi credentials, the DYWS HTTPS API address ending in /api/, the pairing code and the matching serial speed.
5. The controller joins venue WiFi, verifies HTTPS, enrols and saves the configuration. Its setup network then closes. The phone can leave.
6. Send a test ticket from DYWS and check the paper, cut and printer status. Hold the setup button for three seconds to reopen setup when needed.

Manager login stays on the DYWS website. The controller uses its own revocable device credential. Direct backend integration preserves order IDs, location and payment state. Email ingestion and router port forwarding are unnecessary.

BLE is currently a read only diagnostic service. Bluetooth provisioning, Bluetooth printer transport and a dedicated phone app are not implemented. The setup form requires ordinary 2.4 GHz WiFi; interactive captive portals, enterprise WiFi and 5 GHz only networks need separate accommodation.

## Costs and purchasing
The Canadian purchasing research dated **24 October 2026** lists a full pack basket of **C$380.06 before delivery and tax**, including the C$259 printer, C$21.75 controller, C$10.95 converter, C$11.95 USB supply and a full PETG spool. These are dated research prices and stock snapshots, not refreshed quotations.

The ring revision changes the screw lengths and removes the former heat set inserts and right angle converter header. It can use PLA. The C$380.06 historical total is therefore not an exact current ring BOM quote. Use the hardware schedule below and reconcile the final basket before ordering. The regional printer bundle is budgeted with its power adapter, AC lead, USB cable and starter roll; confirm the chosen seller's carton contents.

The original research uses nine storefronts. A six supplier alternative costs approximately C$385.60 before delivery and tax, but changes the button size and rubber pads. The larger 16 mm button in that alternative does not fit the current case. Keep the small COM-11996 button unless CAD is changed.

Printing labour, tools, CAD work, assembly, shipping, sales tax, hosting, support and a UPS are outside those parts prices. Additional paper was quoted at C$87.99 per twelve 68.58 m rolls. A 250 mm ticket consumes about C$0.027 of paper before feed and waste. Thermal printing needs no ink or toner.

## PLA choices
| PLA example | Reference enclosure weight | Comment |
| --- | --- | --- |
| Ordinary PLA at 1.24 g/cm³ | 188.1 g | Straightforward reference for the first prototype; reserve 250 g with tests and allowance |
| PLA Pro example at 1.237 g/cm³ | About 187.6 g | Choose a formulation with documented toughness; the label alone does not define one recipe |
| Denser matte example at 1.37 g/cm³ | About 207.8 g | About 276 g with all tests and 20 percent allowance; reserve 300 g |
| Silk example at 1.24 g/cm³ | About 188.1 g | Glossy decorative finish; use the actual brand's density and mechanical data |

These are manufacturer density examples, not guaranteed densities for every product in a category. PLA is appropriate for checking fit in an indoor prototype. Improved toughness does not automatically mean better heat resistance. Heat and creep performance need testing for the intended venue conditions. The original PETG option remains available.

## Current mechanical build guide
MECHANICAL_GUIDE

## Software status and remaining work
The optional plugin and firmware exist. Firmware compilation and automated software checks previously passed. The plugin remains inactive by default. No physical prototype has been tested or deployed, and no hardware was purchased in this work. DYWS orders, payments and tickets remain demonstrations.

The plugin provides pairing, location assignment, revocable credentials, durable queues, test tickets and recovery controls. The firmware provides protected setup WiFi, verified HTTPS, persistent configuration, serial printing, status queries, cutting and BLE diagnostics. A job with uncertain physical output requires operator review, rather than a silent automatic reprint. Transmission acknowledgement does not prove that a complete legible ticket exists.

Before a venue pilot, verify actual printer feet and support pads, hooks, screws, board and plug fit, cable restraint, loads, temperature and radio range. Exercise wrong WiFi passwords, reconnects, setup recovery, paper out, open lid, long tickets, bursts, cable disconnects, resets and power loss. Confirm recovery never silently duplicates an order. Production work includes protected provisioning, signed updates, fleet alerts, stale order handling and a support workflow.

## Previous designs
The first concept used a 209 × 280 mm base. The first CAD cradle used a 214 × 220 mm footprint and calculated to about 375.4 g PLA. Those files are kept under previous designs in the reference archive. Their hardware and material assumptions are superseded by the current open ring, rabbet hooks and 188.1 g estimate.

## Primary references
[Epson TM-T20IV technical reference](https://files.support.epson.com/pdf/pos/bulk/tm-t20iv_trg_en_rev_c.pdf)
[DFRobot DFR1139 product](https://www.dfrobot.com/product-2837.html)
[FireBeetle mechanical drawing](https://dfimg.dfrobot.com/wiki/20495/DFR1139_firebeetle-2-esp32-e-n16r8_dimension_v1.0.pdf)
[SparkFun MAX3232 hardware source](https://github.com/sparkfun/MAX3232_Breakout)
[Assmann hood drawing](https://www.assmann-wsw.com/uploads/datasheets/ASS_3205_CO.pdf)
[Prusament PLA density](https://prusament.com/wp-content/uploads/2022/10/PLA_Prusament_TDS_2021_10_EN.pdf)
[Polymaker formulation comparison](https://wiki.polymaker.com/polymaker-products/polymaker-filaments/technical-data-at-a-glance)
'''

guide=(HARDWARE/'sidecar-180/README.md').read_text()
guide=guide.split('\n',1)[1].strip()
guide=re.sub(r'^## ',r'### ',guide,flags=re.M)
master=master.replace('MECHANICAL_GUIDE',guide)
for key,token in [('folder','FOLDER_URL'),('printPackage','PRINT_URL'),('preview','PREVIEW_URL'),('parts','PARTS_URL'),('technical','TECH_URL'),('referenceBundle','REFERENCE_URL')]:
    master=master.replace(token,LINKS[key])

parts=(ROOT/'docs/order-printer-canadian-parts-research-20261024.md').read_text()
parts=parts.replace('# Canadian parts research for one DYWS TM-T20IV prototype',
'''# DYWS Canadian parts research
Research snapshot, 24 October 2026

This preserves the original research and source links. Prices, stock and shipping statements are dated observations, not current quotations. The mechanical concept and full basket below predate the final open ring. The current design uses four M3 × 18 mm screws, one M3 × 20 mm screw, four M3 × 12 mm screws, nine M3 nuts and eight rubber pads, with no heat set inserts or right angle converter header. The optional 16 mm button does not fit the current case.

[Use the current build handoff and hardware schedule](MASTER_URL)
[Current printable package](PRINT_URL)
[Reference archive](REFERENCE_URL)
''')
for key,token in [('master','MASTER_URL'),('printPackage','PRINT_URL'),('referenceBundle','REFERENCE_URL')]:parts=parts.replace(token,LINKS[key])

overview=(ROOT/'docs/order-printer.md').read_text()
firmware=(ROOT/'firmware/order-printer/README.md').read_text()
tech='''# DYWS printer software and technical reference
Local pilot implementation, consolidated 28 October 2026

This reference preserves the plugin queue and API contract, firmware wiring, setup, build commands, Bluetooth service and remaining validation. Current orders and payments remain demonstrations. Compilation and automated checks do not establish physical integration or production readiness.

[Current design and build handoff](MASTER_URL)
[Software source and research archive](REFERENCE_URL)
[Canadian purchasing research](PARTS_URL)

'''+overview.replace('# Order Printer pilot','## Plugin and queue overview',1)+'\n\n'+firmware.replace('# DYWS printer firmware','## Firmware source reference',1)
for key,token in [('master','MASTER_URL'),('referenceBundle','REFERENCE_URL'),('parts','PARTS_URL')]:tech=tech.replace(token,LINKS[key])

def blocks(markdown):
    lines=markdown.splitlines();out=[];i=0;title_used=False
    while i<len(lines):
        line=lines[i].strip();i+=1
        if not line:continue
        if line.startswith('```'):
            language=line[3:].strip();code=[]
            while i<len(lines) and not lines[i].strip().startswith('```'):
                code.append(lines[i]);i+=1
            i+=1
            if language=='mermaid':
                out.append({'kind':'paragraph','text':'Phone → controller setup WiFi. Controller → venue WiFi and HTTPS → DYWS API and queue. Controller UART → MAX3232 → Epson. BLE app → read only controller status.'})
            else:
                for c in code:out.append({'kind':'code','text':c or ' '})
            continue
        if line.startswith('|'):
            rows=[]
            while True:
                if not re.match(r'^\|[\s:|\-]+\|$',line):rows.append([c.strip() for c in line.strip('|').split('|')])
                if i>=len(lines) or not lines[i].strip().startswith('|'):break
                line=lines[i].strip();i+=1
            if len(rows[0])==6:
                rows=[['Item and purchase link','Quantity and purpose','CAD cost']]+[[r[0],f'Buy: {r[1]}. Used: {r[2]}. {r[5]}',f'{r[3]}; allocated {r[4]}'] for r in rows[1:]]
            out.append({'kind':'table','rows':rows});continue
        m=re.match(r'^(#{1,6})\s+(.*)',line)
        if m:
            level=len(m.group(1));kind='TITLE' if level==1 and not title_used else ('HEADING_1' if level<=2 else 'HEADING_2')
            title_used=True;out.append({'kind':kind,'text':m.group(2)});continue
        m=re.match(r'^\d+\.\s+(.*)',line)
        if m:out.append({'kind':'numbered','text':m.group(1)});continue
        m=re.match(r'^[-*]\s+(.*)',line)
        if m:out.append({'kind':'bullet','text':m.group(1)});continue
        out.append({'kind':'paragraph','text':line})
    return out

for key,source in [('Master',master),('Parts',parts),('Tech',tech)]:
    (HERE/f'{key.lower()}-source.md').write_text(source)
    (HERE/f'{key.lower()}-blocks.json').write_text(json.dumps(blocks(source),ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:blocks(s) for k,s in [('Master',master),('Parts',parts),('Tech',tech)]},ensure_ascii=False))
