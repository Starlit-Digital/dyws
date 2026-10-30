# DYWS Canadian parts research
Research snapshot, 24 October 2026

This preserves the original research and source links. Prices, stock and shipping statements are dated observations, not current quotations. The mechanical concept and full basket below predate the final open ring. The current design uses four M3 × 18 mm screws, one M3 × 20 mm screw, four M3 × 12 mm screws, nine M3 nuts and eight rubber pads, with no heat set inserts or right angle converter header. The optional 16 mm button does not fit the current case.

[Use the current build handoff and hardware schedule](https://docs.google.com/document/d/1hZZAChdHSPZWoCt0P-sLiSaQwEuy-ulNBwgxmUeDutw/edit?usp=drivesdk)
[Current printable package](https://drive.google.com/file/d/1iTOBq_hw-vCpY84MI-MB59TTvxK6-MdD/view?usp=drivesdk)
[Reference archive](https://drive.google.com/file/d/1a7LNnNC3C0PfvT8ax4Tlms_NjrlkmJoq/view?usp=drivesdk)


Researched 24 October 2026. This is a purchasing reference, not an order. Prices are Canadian dollars before sales tax and delivery unless expressly identified otherwise. Stock is a seller page snapshot and can change. The list assumes soldering tools, a computer and access to an FDM printer are already available.

## Recommendation and budget

Use the Epson **TM-T20IV C31CL47001**, the USB and serial variant, with a **DFRobot FireBeetle 2 ESP32-E N16R2 DFR1139** programmed using Arduino tools. This ESP32 has both WiFi and Bluetooth. Connect its 3.3 V UART to the printer through a genuine **SparkFun MAX3232 BOB-11189**. The printer has a **DB25 female** serial socket, so the custom cable needs a **DB25 male** plug. The Ethernet variant has different connector details and must not be substituted without revisiting the cable. [DFRobot controller](https://www.dfrobot.com/product-2837.html), [SparkFun converter](https://www.sparkfun.com/sparkfun-transceiver-breakout-max3232.html), [Epson printer listing](https://www.shoprbc.com/ca/shop/product_details.php?pid=60187531).

Buying every pack below, including a full 1 kg spool, totals **C$380.06** before shipping and tax. This is a conservative total using C$6.95 for the insert pack whose selected variant price must still be checked. It excludes optional extra paper because the printer bundle includes a starter roll. The purchased inventory exceeds the material used in one unit. At an illustrative 350 g printed mass, the parts assigned to one prototype are approximately **C$331.58**, including its programming cable, with the remaining wire, filament and hardware retained for later builds. The 350 g figure is a costing example, not a slicer result.

There are nine seller storefronts in this fully sourced basket. Shipping can therefore be material. Consolidate ordinary hardware from existing workshop inventory or a local supplier where possible. DigiKey displays C$15 shipping below C$100 and free shipping at C$100 or more for qualifying standard orders. Other delivery charges require a postal code and checkout quote. Do not treat C$380.06 as a delivered quotation. [DigiKey Canadian storefront](https://www.digikey.ca/en/products/detail/dfrobot/DFR1139/24344257).

## Complete parts basket

The installed quantities below are provisional for a cradle, removable electronics lid and detachable rear cable tray. The exact number of enclosure fasteners should be reconciled with final CAD. Pack fractions are accounting estimates, not individual purchasing offers.

| Item and exact choice | Buy | Used for one prototype | Cash outlay | Approximate assigned cost | Availability and purpose |
| --- | --- | --- | ---: | ---: | --- |
| [Epson TM-T20IV C31CL47001 at shopRBC](https://www.shoprbc.com/ca/shop/product_details.php?pid=60187531) | 1 printer bundle | 1 | C$259.00 | C$259.00 | National warehouse, usually ships within 24 to 48 hours; Ottawa pickup requires enquiry. USB and serial model. |
| [DFRobot DFR1139 at DigiKey Canada, 1738-DFR1139-ND](https://www.digikey.ca/en/products/detail/dfrobot/DFR1139/24344257) | 1 board | 1 | C$21.75 | C$21.75 | 89 shown in stock. ESP32 controller, 16 MB flash, 2 MB PSRAM. Headers included unsoldered. |
| [SparkFun BOB-11189 at PiShop, SKU 3083](https://www.pishop.ca/product/sparkfun-transceiver-breakout-max3232/) | 1 converter | 1 | C$10.95 | C$10.95 | In stock. Power the converter at 3.3 V. |
| [Assmann A-DS25LL/Z male solder cup connector at DigiKey, AE10984-ND](https://www.digikey.ca/en/products/detail/assmann-wsw-components/A-DS-25-LL-Z/1241785) | 1 plug | 1 | C$1.14 | C$1.14 | 3,245 shown in stock. Mates with the printer DB25 female socket. |
| [Assmann A-FT 25 hood at DigiKey, AE11004-ND](https://www.digikey.ca/en/products/detail/assmann-wsw-components/A-FT-25/1241836) | 1 hood | 1 | C$2.83 | C$2.83 | 717 shown in stock. Includes cable clamp and assembly hardware, with 4-40 mating screws. |
| [Shielded four conductor 26 AWG cable at Solarbotics, SKU 701116](https://www.solarbotics.com/product/cable-shielded-26awg-4c-grey-ul2547-m/) | 1 metre | About 0.30 metre | C$5.39 | C$1.62 | In stock. Use three conductors for TX, RX and signal ground; insulate the spare. |
| [Official Raspberry Pi 15W USB-C supply, US black, PiShop SKU 1663](https://www.pishop.ca/product/raspberry-pi-15w-power-supply-us-black/) | 1 supply | 1 | C$11.95 | C$11.95 | In stock. 5.1 V, 3 A, North American plug and captive 1.5 m USB-C lead. |
| [USB Type C to USB 2.0 A data cable, 3 ft, PiShop CS-PID-45](https://www.pishop.ca/product/usb-type-c-to-usb-2-0-a-male-cable-3ft/) | 1 cable | 1 programming cable | C$2.95 | C$2.95 | In stock. Used between the computer and controller during flashing. |
| [SparkFun COM-11996 momentary black button, Canada Robotix SKU 2408](https://www.canadarobotix.com/products/2408) | 1 button | 1 | C$1.29 | C$1.29 | More than 50 shown in stock. Normally open setup button, solder lugs and panel mounting nut. |
| [40 female to female 20 cm jumper leads, Canada Robotix SKU 1165](https://www.canadarobotix.com/products/1165) | 1 bundle of 40 | Allow 10 leads | C$6.99 | C$1.75 | 31 shown in stock. Internal prototype wiring and connector pigtails. |
| [40 pin male header at right angle, PiShop SKU 3037](https://www.pishop.ca/product/break-away-male-headers-right-angle/) | 1 strip | 10 pins | C$3.45 | C$0.86 | In stock. For the converter. The controller already includes its own headers. |
| [Heat shrink assortment, PiShop SKU 216](https://www.pishop.ca/product/heat-shrink-pack/) | 1 pack | Several short sleeves | C$6.95 | C$1.00 allowance | In stock. Insulate solder joints and the unused cable conductor. |
| [M2 nylon standoff, screw and nut kit, PiShop SKU 791](https://www.pishop.ca/product/m2-nylon-hex-standoff-spacer-screw-nut-assortment-kit-160-pieces/) | 1 assortment | 4 standoffs, 4 M2 screws, 4 nuts | C$7.95 | C$0.64 indicative | In stock. Seller title says 150 pieces although the URL says 160. Includes 6 mm standoffs and M2 × 6 screws. |
| [M3 × 8 mm Phillips screws, BC Robotics](https://bc-robotics.com/shop/m3-x-8mm-phillips-20-pack/) | 20 screws | Allow 8 | C$1.95 | C$0.78 | In stock. For printed enclosure parts, not the controller PCB. |
| [Brass heat set inserts at 3DLabTech, select M3 × 5 × 4](https://www.3dlabtech.ca/product/heat-set-insert/) | 50 inserts | Allow 8 | C$6.95 budget | C$1.11 | Page shows C$6.45 to C$6.95 across variants. Confirm selected M3 variant price and stock. Design holes to the actual insert drawing. |
| [Adafruit 550 rubber feet at ABRA, 550-ADA](https://abra-electronics.com/hardware/rubber-feet/550-little-rubber-bumper-feet-pack-of-4-550-ada.html?currency=CAD) | 2 packs of 4 | 4 base feet and 4 soft printer contact pads | C$3.68 | C$3.68 | In stock, C$1.84 per pack. Explicit CAD selector in link. Diameter 9.525 mm, height 3.175 mm. |
| [25 mm adhesive cable tie holders, BC Robotics OTH-071](https://bc-robotics.com/shop/25x25mm-adhesive-cable-tie-holder-10-pack/) | 10 holders | Allow 2 | C$0.95 | C$0.19 | Two packs shown remaining. Pair with printed strain relief features. |
| [100 mm white cable ties, BC Robotics OTH-041](https://bc-robotics.com/shop/4-white-cable-ties-100-pack/) | 100 ties | Allow 4 | C$0.95 | C$0.04 | In stock. Bundle wiring and secure cable jackets to strain relief. |
| [Anycubic PETG at the Canadian storefront, black 1.75 mm, 1 kg](https://ca.anycubic.com/products/petg) | 1 spool | Illustrative 350 g | C$22.99 | C$8.05 illustrative | C$22.99 shown. Confirm black variant and delivery at checkout. Final consumption comes from the sliced CAD. |
| **Total** | | | **C$380.06** | **C$331.58 illustrative** | Before shipping and tax. |

The quoted core hardware, cable and pack subtotal without the filament spool is **C$357.07**. Every quantity in the basket is a purchasing quantity, so the full price of the jumper bundle, hardware kits and filament spool is included.

## What the printer bundle supplies

The Canadian OCR listing for the exact **C31CL47001** states that the power supply and USB cable are included. The Epson US and Canada specification sheet lists the printer, starter roll, USB cable, power adapter, AC cord, wall bracket and setup guide. shopRBC does not individually enumerate its carton contents. Treat those items as included in this budget and verify that the unopened C31CL47001 carton matches the regional bundle before paying. [Canadian OCR exact SKU listing](https://support.ocr.ca/stock/Default.aspx/Epson/Printing/Receipt-Printers/Counter-Top/Epson-TM-T20IV-Printers), [Epson specification sheet hosted by a distributor](https://shop.delfi.com/wp-content/uploads/2025/05/tm-t20iv_EN.pdf).

The technical guide calls for **Epson AC adapter C1 or equivalent**. Do not order a PS-180 or PS-190 merely because those names occur in older Epson receipt printer listings. Keep the Epson power brick and the USB power supply outside the printed enclosure. The printer receives its own 24 V supply; the ESP32 receives the separate 5.1 V USB supply. The RS232 connection carries data and signal ground, never printer power. [Epson technical reference guide, page 30](https://files.support.epson.com/pdf/pos/bulk/tm-t20iv_trg_en_rev_c.pdf).

The official Raspberry Pi US supply was chosen because the manufacturer publishes a UL/cUL authorization for the relevant supply family. It is a fixed 5.1 V supply, and the 3 A figure is its capacity, not current forced into the controller. The printer does not power the ESP32 through its serial socket. [Raspberry Pi approvals](https://pip.raspberrypi.com/categories/503-approvals), [UL/cUL authorization](https://pip-assets.raspberrypi.com/categories/503-approvals/documents/RP-007966-CF-1-rpi-15W-PSU%20Authorisation%20of%20UL%20mark%20US%20Variant.pdf).

## Electrical connection and assembly

Use the converter at **3.3 V**, which makes its logic side suitable for the ESP32. Its onboard charge pump creates the RS232 voltage levels. ESP32 GPIO must not connect directly to the printer serial pins. The converter accepts a 3 V to 5.5 V supply, but powering it at 5 V would defeat the reason for choosing a 3.3 V logic interface here. [SparkFun product](https://www.sparkfun.com/sparkfun-transceiver-breakout-max3232.html), [SparkFun schematic](https://cdn.sparkfun.com/datasheets/BreakoutBoards/MAX3232_Breakout_v11.pdf).

The proposed mapping, subject to the firmware pin definitions, is:

| Controller or cable | MAX3232 signal and header pad | Printer connection |
| --- | --- | --- |
| ESP32 3V3 | VCC, pad 5 | None |
| ESP32 GND | GND, pad 6 | DB25 male pin 7, signal ground |
| ESP32 GPIO25, UART TX | T1IN, pad 7 | Through T1OUT, pad 1, to DB25 pin 3, printer RX |
| ESP32 GPIO26, UART RX | R1OUT, pad 9 | Through R1IN, pad 3, from DB25 pin 2, printer TX |
| Setup button | One terminal to firmware setup GPIO, other terminal to GND | None |

The header pad numbers above come from the SparkFun board file. Follow the silkscreen and inspect continuity before first power. DB25 solder cup numbering is viewed from the connector rear, so use the moulded numbers rather than counting left to right from a front view. Use the third cable conductor as signal ground; the cable shield is separate and is not a substitute for that conductor. Insulate the spare conductor and any exposed shield. Configure matching baud rates, 8 data bits, no parity, one stop bit and XON/XOFF flow control. For a completed harness, confirm the printer model and actual pin assignments against its technical guide and verify TX, RX and ground with a continuity meter before connecting it. [SparkFun hardware source](https://github.com/sparkfun/MAX3232_Breakout/tree/master/Hardware), [Epson technical reference guide, pages 97 onward](https://files.support.epson.com/pdf/pos/bulk/tm-t20iv_trg_en_rev_c.pdf).

This uses a short custom cable. It does not need a DB9 adapter or an additional null modem cable. If a commercial RS232 cable is substituted later, verify its actual continuity, connector genders and signal routing. A generic USB to serial adapter is a different device and cannot replace the MAX3232 in this circuit.

The jumper leads are acceptable for a supervised bench prototype. Solder the headers, solder and sleeve the button and cable joints, and restrain the harness. For a venue unit, replace loose individual connectors with a keyed harness or a soldered carrier assembly. This list does not establish a vibration, ingress or production reliability rating.

## Mechanical findings relevant to the render

The controller choice must remain **DFR1139** throughout the render and enclosure design. Its PCB is 60 × 25.4 mm, with 4 holes of 2 mm diameter on 56.6 × 22 mm centres. The full outline including the USB projection is approximately 61.47 mm long. The documented board height is 6.62 mm before optional added headers. Use M2 nylon hardware for the board. Do not place M3 screws through its PCB holes. [DFRobot product and drawing resources](https://www.dfrobot.com/product-2837.html).

The **BOB-11189** PCB is **25.4 × 13.97 mm**, calculated directly from the board outline in the manufacturer EAGLE file. It has one row of ten holes at 2.54 mm pitch and no mounting holes. Use a printed insulating clip or carrier. Its header and attached female connectors need additional clearance beyond the PCB rectangle. [SparkFun board source](https://raw.githubusercontent.com/sparkfun/MAX3232_Breakout/master/Hardware/SparkFun_MAX3232_Breakout.brd).

The **A-FT 25 hood** drawing gives **56.3 ±0.5 mm width, 36.5 ±0.5 mm length and 14.8 ±0.38 mm thickness**. Its thumb screws are 48.5 mm overall and use 4-40 UNC threads. The cable opening is 11 mm. These dimensions require real space behind the printer in addition to cable bending clearance. [Assmann hood](https://www.assmann-wsw.com/us/product/a-ft-25/), [manufacturer drawing, page 3](https://www.assmann-wsw.com/uploads/datasheets/ASS_3205_CO.pdf).

The setup button has a **6.75 mm threaded mounting diameter** and about **26.9 mm overall length including solder lugs**. Allow rear wiring clearance and verify the received nut and shoulder before finalising the panel opening. [Canada Robotix switch specifications](https://www.canadarobotix.com/products/2408).

The proposed render uses the stock printer body of **146 × 199 × 146 mm** and allows its lid to reach **268 mm above the printer foot plane** when open. [Epson technical reference guide, page 95](https://files.support.epson.com/pdf/pos/bulk/tm-t20iv_trg_en_rev_c.pdf). The surrounding cradle is provisionally **209 × 280 mm**, with a lower 55 mm wide electronics bay and approximately 70 mm of open rear service space. A proposed **209 × 214 mm main cradle plus 209 × 66 mm rear tray** suits a nominal 220 mm printer bed, subject to brim and machine clearance. These are design choices rather than Epson dimensions. Check hood, USB plug and power plug projection on the received printer before freezing CAD. Preserve printer vents, paper exit, lid travel and access to controls. Keep metal and wiring away from the controller antenna region. The image is illustrative; fabrication CAD and physical fit validation remain to be completed.

## Consumables, alternatives and omissions

| Item | Canadian purchase reference | Budget and condition |
| --- | --- | --- |
| Additional thermal paper | [Staples 44311, model 9078-0400, 12 rolls of 3 1/8 inch × 225 ft](https://www.staples.ca/products/44311-en-staples-thermal-paper-rolls-3-18-x-225-12-pack) | C$87.99 per 12 rolls, or C$7.33 per roll. Optional because a starter roll is bundled. Delivery availability depends on postcode. |
| Serial cable gland | [Bud Industries IPG-2227-G, BC Robotics CAB-046](https://bc-robotics.com/shop/cable-gland-pg-7/) | C$1.95. Optional alternative to printed strain relief. Fits cable outside diameter 3 to 6 mm, 13 mm panel opening and wall thickness up to 4 mm. Measure the chosen cable first. |
| USB data cable for a computer with only USB-C ports | [USB-C to USB-C USB 3.2 Gen 2, 3 ft, PiShop](https://www.pishop.ca/product/usb-type-c-to-usb-type-c-cable-usb-3-2-gen-2-3ft/) | C$9.95 listed in the seller category during research. Replace the C$2.95 USB A cable if required; direct product stock should be reconfirmed. An existing known data cable costs nothing extra. |
| Spare converter | [Second BOB-11189 at PiShop](https://www.pishop.ca/product/sparkfun-transceiver-breakout-max3232/) | Optional C$10.95. Useful during first serial wiring experiments, not required for normal operation. |

Epson specifies paper width **79.5 ±0.5 mm** and maximum roll diameter **83 mm**. A nominal 80 mm receipt roll is appropriate only when its diameter and paper specification also fit. The linked Staples roll is approximately 79.375 mm wide and 76.2 mm in diameter. At 225 ft, each full roll is 68.58 m. As an example, a 250 mm order uses about C$0.027 of paper at that pack price, before waste. Actual receipt lengths vary. [Epson specification sheet](https://shop.delfi.com/wp-content/uploads/2025/05/tm-t20iv_EN.pdf), [Staples roll](https://www.staples.ca/products/44311-en-staples-thermal-paper-rolls-3-18-x-225-12-pack).

At C$22.99/kg, PETG costs C$0.02299/g. A 250 g print consumes C$5.75 of filament; 350 g consumes C$8.05; 500 g consumes C$11.50. These figures exclude supports, brim, failed prints, electricity, machine time and design labour. An outsourced enclosure needs a quotation from the actual STL or 3MF files. The spool purchase is already in the basket, so these consumed material figures must not be added to the C$380.06 again.

Workshop requirements are a soldering iron, solder and flux, wire stripper, small cutters, heat source for tubing, screwdrivers, calipers and a multimeter. Access to two mains outlets is required unless a suitable existing power strip is used. These shared tools and site infrastructure are excluded from the component subtotal. No battery, separate Bluetooth module, WiFi dongle, display or additional Arduino Uno is required for this design.

Initial setup uses the controller's own WiFi network. The phone joins that network, opens the setup page, supplies venue WiFi credentials and links the device to DYWS. The controller then joins the venue network and obtains print jobs from the backend. Bluetooth remains available on the selected hardware. A 2.4 GHz venue network, usable internet access and the backend pairing workflow are operational prerequisites; a captive portal or network requiring interactive browser login needs separate accommodation. Hardware capability is not evidence that all firmware setup and recovery flows have been physically tested.

## Remaining verification

Before ordering, confirm the C31CL47001 carton contents at the chosen seller, the insert variant and its actual dimensions, and delivery charges. Before building, reconcile the table's fastener counts with CAD and verify the power, USB and serial plug clearances on received parts. Before venue use, validate WiFi reconnection, setup recovery, Bluetooth behaviour, paper out and lid open conditions, flow control and prevention of duplicate orders. This research validates part selection and source availability; it is not a physical integration test.

## Optional basket consolidation

A bounded followup found practical alternatives that can reduce the original nine storefronts to six. Keep the original basket as the dimensional reference until the substitute button and feet are checked. These replacements change the pack subtotal to approximately **C$385.60**, an increase of **C$5.54** before delivery, while eliminating separate Canada Robotix, ABRA and Anycubic orders. Compare the actual combined shipping quotes before choosing this option.

| Replace | Consolidated alternative | Price and qualification |
| --- | --- | --- |
| Canada Robotix jumper bundle | [PiShop SKU 285, 40 female to female 20 cm leads](https://www.pishop.ca/product/40-x-jumper-cable-for-arduino-20cm/) | C$2.95, in stock. Same connector format and length; wire gauge is not stated. Saves C$4.04. |
| ABRA feet, two packs | [PiShop SKU 44, four clear rubber feet](https://www.pishop.ca/product/anti-slip-rubber-feet-pads-for-raspberry-pi/) | C$1.45 per pack, in stock; two packs cost C$2.90. Saves C$0.78. Diameter and thickness are not stated, so measure and adjust the enclosure clearance. |
| Anycubic spool | [Solarbotics SKU 60950, eSun PETG175SB1 black 1.75 mm PETG, 1 kg](https://www.solarbotics.com/product/esun-1-75mm-petg-solid-black-filament-1kg-spool/) | C$32.95, in stock. Adds C$9.96, but combines with the shielded cable shipment. |
| Canada Robotix setup button | [Solarbotics 17396 family, R13-507 momentary SPST panel button](https://www.solarbotics.com/product/17396/) | C$1.69 listed, select black and confirm variant stock. Adds C$0.40. Includes nut and lock washer, but needs a different 16 mm panel hole and 19 mm bezel clearance. |

The six remaining storefronts would be shopRBC, DigiKey, PiShop, Solarbotics, BC Robotics and 3DLabTech. BC Robotics already combines the M3 screws, cable ties, anchors and optional cable gland. No verified available replacement for the insert pack was found within this short followup. The DigiKey Adafruit 4255 insert alternative was shown out of stock, so it was not promoted. PiShop lists black PETG at C$24.95, but its product page did not confirm stock, so the stocked Solarbotics option is used above. [DigiKey insert availability](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/4255/10244656), [PiShop PETG listing](https://www.pishop.ca/product/petg-1-75mm-filament-black-1-kg/).

If retaining the smaller original button, the other three substitutions alone leave seven storefronts and a C$385.20 pack subtotal. The stated 300 mm overall lid clearance allowance remains appropriate for planning while base thickness and the actual upper and lower pads are reconciled with the printer's 268 mm lid height.
