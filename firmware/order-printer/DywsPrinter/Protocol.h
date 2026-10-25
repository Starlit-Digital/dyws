#pragma once
#include <stddef.h>
#include <stdint.h>
#include <string.h>
namespace ReceiptProtocol {
enum class Health { Ready, PaperOut, Unavailable };
inline Health epsonStatus(int printer, int paper) {
  if (printer < 0 || paper < 0 || (printer & 0x93) != 0x12 || (paper & 0x93) != 0x12) return Health::Unavailable;
  if (paper & 0x60) return Health::PaperOut;
  return (printer & 0x28) ? Health::Unavailable : Health::Ready;
}
inline Health dfrobotStatus(const uint8_t* bytes, size_t count) {
  if (count != 3) return Health::Unavailable;
  if (bytes[0] == 0xFE && bytes[1] == 0x23 && bytes[2] == 0x12) return Health::Ready;
  if (bytes[0] == 0xEF && bytes[1] == 0x23 && bytes[2] == 0x1A) return Health::PaperOut;
  return Health::Unavailable;
}
inline bool validTicket(const char* text, size_t size) {
  if (!size || size > 14000) return false;
  for (size_t i = 0; i < size; ++i) if (text[i] != '\n' && (uint8_t(text[i]) < 32 || uint8_t(text[i]) > 126)) return false;
  return true;
}
// Never resume UART output from a persisted journal after a reset.
inline const char* recoveryAction(const char* phase) { return !strcmp(phase, "sent") ? "sent" : "uncertain"; }
}
