#!/usr/bin/env bash
set -euo pipefail
printer_root="$(cd "$(dirname "$0")" && pwd)"
printer_cli="${ARDUINO_CLI:-arduino-cli}"
printer_args=()
if [[ -n "${ARDUINO_CLI_CONFIG:-}" ]]; then printer_args+=(--config-file "$ARDUINO_CLI_CONFIG"); fi
"$printer_cli" "${printer_args[@]}" compile \
  --fqbn 'esp32:esp32:esp32:FlashSize=16M,PartitionScheme=app3M_fat9M_16MB,PSRAM=enabled' \
  --build-path "${DYWS_PRINTER_BUILD_DIR:-${TMPDIR:-/tmp}/dyws-printer-build}" \
  "$printer_root/DywsPrinter"
