#include "../firmware/order-printer/DywsPrinter/Protocol.h"
#include <cassert>
#include <iostream>
int main(){
 using namespace ReceiptProtocol;
 assert(epsonStatus(0x12,0x12)==Health::Ready);
 assert(epsonStatus(0x1a,0x72)==Health::PaperOut);
 assert(epsonStatus(0x1a,0x12)==Health::Unavailable);
 assert(epsonStatus(0x32,0x12)==Health::Unavailable);
 assert(epsonStatus(-1,0x12)==Health::Unavailable);
 assert(epsonStatus(0x11,0x13)==Health::Unavailable);
 uint8_t yes[]={0xFE,0x23,0x12},no[]={0xEF,0x23,0x1A},bad[]={0xFE,0x23,0x1A};
 assert(dfrobotStatus(yes,3)==Health::Ready);
 assert(dfrobotStatus(no,3)==Health::PaperOut);
 assert(dfrobotStatus(yes,2)==Health::Unavailable);
 assert(dfrobotStatus(bad,3)==Health::Unavailable);
 assert(validTicket("ORDER\n2 x Tea\n",14));
 assert(!validTicket("bad\x1b@",5));
 assert(!validTicket("",0));
 assert(!validTicket("\xc3\xa9",2));
 assert(!strcmp(recoveryAction("sent"),"sent"));
 for(const char* phase:{"starting","printing","uncertain","corrupt",""})assert(!strcmp(recoveryAction(phase),"uncertain"));
 std::cout<<"Printer firmware protocol checks passed.\n";
}
