# DYWS printer firmware

This is a compiling hardware pilot for DFRobot FireBeetle 2 ESP32-E N16R2, SKU DFR1139. It uses the Arduino framework on the original ESP32. No device has been flashed or physically tested yet. Current DYWS orders and payments remain demonstrations.

## Setup and operation

1. Enable **Order Printer** in DYWS Plugins, open its editor, choose the business location and printer profile, then create a pairing code. Keep the code and backend API address available before switching networks. The backend must have a valid HTTPS certificate.
2. Flash the firmware over USB. Read the unique `DYWS-xxxxxx` network name and password from the serial monitor at 115200 baud. Put these setup credentials on the device label. The serial monitor does not print the venue password, device token or customer orders.
3. Connect the phone to that network. Keep the connection if the phone warns that it has no internet. Open `http://192.168.4.1` if the setup page does not open automatically.
4. Enter the venue's 2.4 GHz WiFi name and password, the HTTPS backend API address ending in `/api/`, the pairing code and the printer's serial speed. Choose 19200 only if it matches the DFRobot self test, or configure the Epson to 38400 as described below.
5. The device joins the venue WiFi while retaining its setup access point. It obtains network time, verifies the backend TLS certificate and enrolls. It saves the working configuration only after verification succeeds. The phone may briefly reconnect when the ESP32 changes radio channel.
6. After success the setup network closes after 15 seconds. Reconnect the phone to venue WiFi and use the ordinary DYWS login to manage printers. Select **Print test ticket**. The phone is not needed for subsequent printing.

The setup password protects the local setup page. Manager login stays on DYWS. The device uses its own revocable credential, not a manager password. No router port forwarding is required. Hold the GPIO14 setup button for three seconds to reopen setup. An unattended setup window closes after 15 minutes. A failed boot connection opens setup; a later WiFi outage uses automatic reconnection.

For a WiFi change, leave the pairing code blank and retain the existing backend address. A pending ticket prevents changing backend or identity, but still permits changing WiFi to restore acknowledgement. Resolve uncertain output in DYWS before any factory erase. Erasing flash creates a new device identity and must be followed by revoking the old device and pairing again.

## Connections

| ESP32 connection | Purpose |
| --- | --- |
| GPIO25 | Printer UART TX |
| GPIO26 | Printer UART RX, required for status and flow control |
| GPIO14 to GND | Normally open setup button, internal pullup |
| USB-C | Regulated 5 V controller power and programming |
| GND | Common signal ground with the serial interface |

Avoid GPIO16 and GPIO17 on this PSRAM board. Verify the actual FireBeetle pin labels before assembly.

**Epson TM-T20IV:** use a MAX3232 interface powered at 3.3 V. Never connect the Epson RS232 pins directly to ESP32 GPIO. Wire ESP32 TX to converter T1IN, T1OUT to printer RX; printer TX to converter R1IN, R1OUT to ESP32 RX. Connect signal ground. Configure the printer for 38400 baud, 8 data bits, no parity, one stop bit, XON/XOFF, and BUSY on buffer full or offline. Disable serial reset functions and automatic status back if previously enabled. Match the firmware's speed to the printer self test. The firmware handles XON/XOFF and queries real time status explicitly.

For **C31CL47001**, the USB and serial model, Epson specifies a DB25 female connector: printer RX pin 3, TX pin 2, signal ground pin 7. The USB, Ethernet and serial variant uses DB9 male: RX pin 2, TX pin 3, signal ground pin 5. Confirm the purchased model and cable continuity; generic converter DB9 adapters are not necessarily wired for this printer. See [Epson's reference guide, pages 97 to 100](https://files.support.epson.com/pdf/pos/bulk/tm-t20iv_trg_en_rev_c.pdf).

Use the Epson's specified external power supply and a separate regulated USB supply for the ESP32. Do not power a printer from the controller board. Leave both mains adapters outside the printed enclosure.

**DFRobot DFR0503-EN:** use its documented 3.3 V TTL serial connector, crossed TX/RX and common ground. Use a separate printer supply meeting its 9 to 24 V specification and peak current. The firmware uses the model's three byte paper status response and does not issue a cutter command. Consult the [DFRobot datasheet](https://dfimg.dfrobot.com/wiki/19355/DFR0503-EN_embedded-thermal-printer_datasheet_V1.0.pdf) before selecting the power supply and cable.

## Build

Verified toolchain: Arduino CLI 1.5.1, `esp32:esp32@3.3.12`, ArduinoJson 7.4.2. Install from the official Arduino and Espressif package sources. This build does not install or flash anything automatically.

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.12 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli lib install ArduinoJson@7.4.2
bash firmware/order-printer/build.sh
```

`ARDUINO_CLI`, `ARDUINO_CLI_CONFIG` and `DYWS_PRINTER_BUILD_DIR` can override the binary, configuration file and output directory. Default build output is outside the repository. The FQBN is `esp32:esp32:esp32:FlashSize=16M,PartitionScheme=app3M_fat9M_16MB,PSRAM=enabled`. The generic ESP32 target is intentional because the older FireBeetle board entry describes a 4 MB device. Confirm PSRAM and flash on the physical DFR1139 during bringup. The selected partition map reserves two application slots; OTA updating itself is not implemented.

`TrustedRoots.h` contains the public ISRG Root X1 certificate. Check the deployment's actual certificate chain before flashing. Add its appropriate public CA trust anchor if it is different. The code rejects HTTP backends, redirects and invalid certificates; do not substitute `setInsecure()`. Internet time is required after boot for TLS validity checks.

Native protocol checks, which exercise the same status decoder and ticket validator used by the sketch:

```sh
c++ -std=c++17 -Wall -Wextra -Werror tests/printer-protocol.test.cpp -o /tmp/dyws-printer-protocol-test
/tmp/dyws-printer-protocol-test
```

## Bluetooth

BLE is enabled alongside WiFi. Service `698c1c40-4352-4af3-a786-357ab1ef1000` contains a read only diagnostic characteristic `698c1c40-4352-4af3-a786-357ab1ef1001`. A generic BLE diagnostic app can read states such as `ready`, `paper_out`, `wifi_offline` or `review_in_dyws`. It exposes no order content or credentials and resumes advertising after disconnection.

Bluetooth provisioning, a dedicated mobile app and Bluetooth printer transport are not implemented. The original ESP32 hardware supports Classic and BLE, but this firmware enables BLE diagnostics only. Setup is through the device's WiFi and works without browser Bluetooth support.

## Reliability and remaining validation

The persistent journal stores only a job ID, lease and phase. The device must receive server permission to start before writing ticket bytes. It validates text to reject embedded printer control codes. On a reset, it acknowledges a previously transmitted ticket or reports uncertain output. It never resumes UART output from a saved job. An expired reservation that never started may be safely claimed again by the backend. A started job is never automatically retried.

`Sent to printer` records transmission and a final status response. It is not proof that a complete, legible physical ticket exists. Paper loss, cutter trouble, disconnects and power loss can require operator review. Recovery copies are marked `COPY / REPRINT`. Until a physical pilot passes, use this only with demonstration orders.

Before venue use, verify phone setup on iPhone and Android, wrong password recovery, changed venue credentials, TLS renewal, BLE reconnection, serial status and XON/XOFF at the selected baud, long tickets, paper removal halfway through output, cover opening, cable removal, printer and controller resets, lost acknowledgement responses and a sustained order burst. Confirm that recovered tickets are never silently duplicated. Verify a receipt's accented names and required kitchen notes; this pilot transliterates text to ASCII.

Remaining product work includes signed OTA and recovery, secure boot and flash encryption provisioning, protected production key handling, a device label or QR manufacturing flow, a physical status LED or buzzer, retention policy, stale ticket handling, fleet monitoring and enclosure CAD with thermal and RF tests. The concept image's external status LED is not wired by this pilot firmware. Captive venue login pages, enterprise WiFi and 5 GHz only networks are not supported by the setup form.
