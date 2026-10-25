/* DYWS printer pilot. Arduino ESP32 3.3.12, ArduinoJson 7.4.2.
 * DFRobot FireBeetle 2 ESP32-E N16R2 (DFR1139), original ESP32.
 * Printer TX GPIO25, RX GPIO26. Setup button GPIO14 to GND.
 * RS232 Epson MUST use a 3.3 V MAX3232 converter. See ../README.md.
 */
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <esp_system.h>
#include <time.h>
#include "Protocol.h"
#include "Portal.h"
#include "TrustedRoots.h"

constexpr int PRINTER_TX=25, PRINTER_RX=26, SETUP_BUTTON=14;
constexpr uint32_t POLL_MS=5000;
Preferences prefs;
WebServer portal(80);
DNSServer dns;
HardwareSerial printer(2);
BLECharacteristic* diagnostic=nullptr;
class DiagnosticCallbacks : public BLEServerCallbacks {
  void onDisconnect(BLEServer* server) override { server->startAdvertising(); }
};
struct Configuration { String ssid,password,api,token,profile; uint32_t baud=38400; } config,candidate;
String deviceId,apPassword,csrf,pairingCode;
String setupMessage="Ready to configure.",health="starting";
bool setupActive=false,configurationPending=false,setupDone=false,xoff=false,storageOK=false;
uint32_t nextPoll=0,setupStarted=0,closeSetupAt=0,buttonSince=0;
bool buttonHandled=false;

String randomHex(size_t bytes) {
  static const char hex[]="0123456789abcdef"; String out;out.reserve(bytes*2);
  for(size_t i=0;i<bytes;i++){uint8_t b=uint8_t(esp_random());out+=hex[b>>4];out+=hex[b&15];}return out;
}
void setHealth(const String& value) { health=value;if(diagnostic)diagnostic->setValue(value); }
String serializeConfig(const Configuration& c) {
  JsonDocument d;d["ssid"]=c.ssid;d["password"]=c.password;d["api"]=c.api;d["token"]=c.token;d["profile"]=c.profile;d["baud"]=c.baud;
  String out;serializeJson(d,out);return out;
}
bool configured(){return config.token.length()==64&&config.ssid.length()&&config.api.startsWith("https://");}
bool validApi(const String& api) {
  if(!api.startsWith("https://")||api.length()>200||!api.endsWith("/api/"))return false;
  for(size_t i=0;i<api.length();i++)if(uint8_t(api[i])<=32||uint8_t(api[i])>126||api[i]=='@'||api[i]=='?'||api[i]=='#'||api[i]=='\\')return false;
  return api.indexOf('/',8)>8;
}
bool post(const Configuration& c,const char* action,JsonDocument& request,JsonDocument& response,int& result) {
  result=0;if(WiFi.status()!=WL_CONNECTED||time(nullptr)<1767225600)return false;
  NetworkClientSecure tls;tls.setCACert(DYWS_ROOT_CA);tls.setHandshakeTimeout(12);
  HTTPClient http;http.setConnectTimeout(10000);http.setTimeout(12000);http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  if(!http.begin(tls,c.api+"?route=/plugins/order-printer/"+action))return false;
  http.addHeader("Content-Type","application/json");http.addHeader("X-DYWS-Printer-Token",c.token);
  String body;serializeJson(request,body);result=http.POST(body);
  if(result<200||result>=300||http.getSize()>24576){http.end();return false;}
  // Endpoint is the manager selected DYWS server; never log its response or credentials.
  String reply=http.getString();http.end();
  return reply.length()<=24576&&!deserializeJson(response,reply,DeserializationOption::NestingLimit(8));
}
bool saveJournal(const String& id,const String& lease,const char* phase) {
  JsonDocument d;d["id"]=id;d["lease"]=lease;d["phase"]=phase;String out;serializeJson(d,out);
  return storageOK&&prefs.putString("journal",out)==out.length();
}
bool ack(const String& id,const String& lease,const char* action) {
  JsonDocument request,response;request["jobId"]=id;request["lease"]=lease;request["action"]=action;int result;
  return post(config,"ack",request,response,result)&&response["ok"]==true;
}
bool recoverJournal() {
  String raw=prefs.getString("journal","");if(raw.isEmpty())return true;
  JsonDocument d;if(deserializeJson(d,raw)||!d["id"].is<String>()||!d["lease"].is<String>()){setHealth("storage_error");return false;}
  const char* action=ReceiptProtocol::recoveryAction(d["phase"]|"");setHealth(String("recovering_")+action);
  if(ack(d["id"].as<String>(),d["lease"].as<String>(),action))return prefs.remove("journal");
  return false;
}
void consumeFlow() { while(printer.available()){int b=printer.read();if(b==0x13)xoff=true;else if(b==0x11)xoff=false;} }
int epsonQuery(uint8_t number) {
  consumeFlow();const uint8_t command[]={0x10,0x04,number};printer.write(command,sizeof(command));printer.flush();
  uint32_t until=millis()+1500;
  while(int32_t(until-millis())>0){if(printer.available()){int b=printer.read();if(b==0x11){xoff=false;continue;}if(b==0x13){xoff=true;continue;}if((b&0x93)==0x12)return b;}delay(2);}return -1;
}
ReceiptProtocol::Health printerHealth() {
  using namespace ReceiptProtocol;
  if(config.profile=="epson80") {int first=epsonQuery(1);int paper=epsonQuery(4);return epsonStatus(first,paper);}
  if(config.profile!="dfrobot58")return Health::Unavailable;
  while(printer.available())printer.read();
  const uint8_t command[]={0x10,0x04,0x01};printer.write(command,sizeof(command));printer.flush();
  uint8_t reply[3];size_t count=0;uint32_t until=millis()+1500;
  while(count<3&&int32_t(until-millis())>0){if(printer.available())reply[count++]=printer.read();else delay(2);}return dfrobotStatus(reply,count);
}
bool sendBytes(const uint8_t* bytes,size_t size) {
  for(size_t i=0;i<size;i++){
    if(config.profile=="epson80"){
      consumeFlow();uint32_t until=millis()+5000;
      while(xoff&&int32_t(until-millis())>0){consumeFlow();delay(2);}if(xoff)return false;
    }
    if(printer.write(bytes+i,1)!=1)return false;
  }printer.flush();return true;
}
bool printTicket(const String& text,bool cut) {
  const uint8_t init[]={0x1B,0x40};if(!sendBytes(init,sizeof(init)))return false;delay(150);
  size_t offset=0;
  // Send at most one text line at a time, checking paper between lines.
  while(offset<text.length()){
    if(printerHealth()!=ReceiptProtocol::Health::Ready)return false;
    size_t end=offset;while(end<text.length()&&text[end]!='\n')end++;if(end<text.length())end++;
    if(!sendBytes(reinterpret_cast<const uint8_t*>(text.c_str()+offset),end-offset))return false;
    delay(config.profile=="dfrobot58"?180:70);offset=end;
  }
  const uint8_t feed[]={0x0A,0x0A,0x0A};if(!sendBytes(feed,sizeof(feed)))return false;
  if(cut&&config.profile=="epson80"){const uint8_t command[]={0x1D,0x56,0x42,0x00};if(!sendBytes(command,sizeof(command)))return false;}
  delay(1000);return printerHealth()==ReceiptProtocol::Health::Ready;
}
void pollOrders() {
  if(!recoverJournal())return;
  auto state=printerHealth();String status=state==ReceiptProtocol::Health::Ready?"ready":state==ReceiptProtocol::Health::PaperOut?"paper_out":"printer_unavailable";
  setHealth(status);JsonDocument request,response;request["status"]=status;int result;
  if(!post(config,"poll",request,response,result)){setHealth(result==401?"pairing_revoked":"backend_unavailable");return;}
  if(response["job"].isNull()){if(response["attention"]==true)setHealth("review_in_dyws");return;}
  JsonObject job=response["job"];String id=job["id"]|"",lease=job["lease"]|"",text=job["text"]|"",profile=job["profile"]|"";
  if(id.isEmpty()||lease.length()!=48||profile!=config.profile||!ReceiptProtocol::validTicket(text.c_str(),text.length())){setHealth("invalid_ticket");return;}
  if(!saveJournal(id,lease,"starting")){setHealth("storage_error");return;}
  if(!ack(id,lease,"start")){recoverJournal();return;}
  if(!saveJournal(id,lease,"printing")){setHealth("storage_error");return;}
  setHealth("printing");bool sent=printTicket(text,job["cut"]|false);
  // Persist before ACK. Reboot recovery sends only ACK, never ticket bytes.
  if(!saveJournal(id,lease,sent?"sent":"uncertain")){setHealth("storage_error");return;}
  recoverJournal();setHealth(sent?"ready":"review_in_dyws");
}
bool fromSetupNetwork(){return setupActive&&portal.client().localIP()==WiFi.softAPIP();}
bool setupHost(){String host=portal.hostHeader();return host=="192.168.4.1"||host=="192.168.4.1:80";}
void jsonReply(int code,const String& message){JsonDocument d;d["message"]=message;String out;serializeJson(d,out);portal.send(code,"application/json",out);}
void startSetup() {
  if(setupActive)return;
  setupActive=true;setupDone=false;configurationPending=false;setupStarted=millis();closeSetupAt=0;csrf=randomHex(16);setupMessage="Ready to configure.";
  WiFi.mode(WIFI_AP_STA);WiFi.softAP((String("DYWS-")+deviceId.substring(deviceId.length()-6)).c_str(),apPassword.c_str(),1,false,1);
  dns.start(53,"*",WiFi.softAPIP());portal.begin();setHealth("setup");
}
void stopSetup() {portal.stop();dns.stop();WiFi.softAPdisconnect(true);WiFi.mode(WIFI_STA);setupActive=false;setupDone=false;nextPoll=millis()+POLL_MS;}
bool connectVenue(const Configuration& c) {
  WiFi.disconnect();WiFi.begin(c.ssid.c_str(),c.password.c_str());uint32_t until=millis()+25000;
  while(WiFi.status()!=WL_CONNECTED&&int32_t(until-millis())>0){if(setupActive){dns.processNextRequest();portal.handleClient();}delay(10);}
  if(WiFi.status()!=WL_CONNECTED)return false;
  configTime(0,0,"pool.ntp.org","time.cloudflare.com");until=millis()+15000;
  while(time(nullptr)<1767225600&&int32_t(until-millis())>0){if(setupActive){dns.processNextRequest();portal.handleClient();}delay(10);}
  return time(nullptr)>=1767225600;
}
void applyCandidate() {
  setupMessage="Connecting to venue WiFi and checking secure backend access…";
  bool ok=connectVenue(candidate);JsonDocument request,response;int result=0;
  if(ok){
    if(pairingCode.length()) {request["code"]=pairingCode;request["token"]=candidate.token;request["deviceId"]=deviceId;ok=post(candidate,"enroll",request,response,result);}
    else {request["status"]="printer_unavailable";ok=post(candidate,"poll",request,response,result);}
  }
  if(ok){candidate.profile=response["profile"]|"";ok=candidate.profile=="epson80"||candidate.profile=="dfrobot58";}
  if(ok){String saved=serializeConfig(candidate);ok=prefs.putString("config",saved)==saved.length();if(ok)prefs.remove("pairDraft");}
  pairingCode="";configurationPending=false;
  if(ok){config=candidate;printer.end();printer.begin(config.baud,SERIAL_8N1,PRINTER_RX,PRINTER_TX);xoff=false;setupDone=true;setupMessage="Connected and paired. Reconnect your phone to venue WiFi and open DYWS. This setup network closes in 15 seconds.";closeSetupAt=millis()+15000;setHealth("paired");}
  else {setupMessage="Could not verify WiFi, time or backend pairing. Check the network, HTTPS certificate and pairing code. Previous settings were kept.";if(configured())WiFi.begin(config.ssid.c_str(),config.password.c_str());}
  candidate=Configuration();
}
void setup() {
  Serial.begin(115200);pinMode(SETUP_BUTTON,INPUT_PULLUP);storageOK=prefs.begin("dyws-printer",false);
  if(!storageOK){Serial.println("Storage unavailable. Printing disabled.");return;}
  deviceId=prefs.getString("device","");if(deviceId.isEmpty()){deviceId="dyws"+randomHex(8);storageOK=prefs.putString("device",deviceId)==deviceId.length();}
  apPassword=prefs.getString("apPassword","");if(apPassword.isEmpty()){apPassword=randomHex(8);storageOK=storageOK&&prefs.putString("apPassword",apPassword)==apPassword.length();}
  // Only setup network credentials are printed, for the physical device label.
  Serial.println("Setup WiFi: DYWS-"+deviceId.substring(deviceId.length()-6));Serial.println("Setup password: "+apPassword);Serial.println("Setup URL: http://192.168.4.1");
  JsonDocument saved;if(!deserializeJson(saved,prefs.getString("config","{}"))){config.ssid=saved["ssid"]|"";config.password=saved["password"]|"";config.api=saved["api"]|"";config.token=saved["token"]|"";config.profile=saved["profile"]|"";config.baud=saved["baud"]|38400;}
  BLEDevice::init("DYWS Printer");BLEServer* server=BLEDevice::createServer();
  server->setCallbacks(new DiagnosticCallbacks());
  BLEService* service=server->createService("698c1c40-4352-4af3-a786-357ab1ef1000");
  diagnostic=service->createCharacteristic("698c1c40-4352-4af3-a786-357ab1ef1001",BLECharacteristic::PROPERTY_READ);diagnostic->setValue("starting");service->start();
  BLEDevice::getAdvertising()->addServiceUUID(service->getUUID());BLEDevice::getAdvertising()->start();
  // Diagnostics expose only a coarse status, never orders, credentials or customer data.
  portal.on("/",HTTP_GET,[]{if(!fromSetupNetwork()){portal.send(403);return;}if(!setupHost()){portal.sendHeader("Location","http://192.168.4.1/");portal.send(302,"text/plain","");return;}portal.sendHeader("Cache-Control","no-store");portal.send_P(200,"text/html",PORTAL_HTML);});
  portal.on("/status",HTTP_GET,[]{if(!fromSetupNetwork()||!setupHost()){portal.send(403);return;}JsonDocument d;d["csrf"]=csrf;d["message"]=setupMessage;d["busy"]=configurationPending;d["done"]=setupDone;d["api"]=config.api;String out;serializeJson(d,out);portal.sendHeader("Cache-Control","no-store");portal.send(200,"application/json",out);});
  portal.on("/configure",HTTP_POST,[]{
    if(!fromSetupNetwork()||!setupHost()||portal.arg("csrf")!=csrf){portal.send(403);return;}
    if(configurationPending||setupDone){jsonReply(409,"Setup is already running.");return;}
    candidate=Configuration();candidate.ssid=portal.arg("ssid");candidate.password=portal.arg("password");candidate.api=portal.arg("api");candidate.baud=portal.arg("baud").toInt();pairingCode=portal.arg("code");
    bool codeOK=pairingCode.length()==32;for(size_t i=0;i<pairingCode.length();i++)if(!isxdigit(pairingCode[i])||isupper(pairingCode[i]))codeOK=false;
    bool same=configured()&&config.api==candidate.api&&pairingCode.isEmpty();
    if(!same&&!prefs.getString("journal","").isEmpty()){jsonReply(409,"A ticket awaits acknowledgement. Keep the current backend and pairing code blank. You can update venue WiFi to restore access.");return;}
    if(candidate.ssid.isEmpty()||candidate.ssid.length()>32||candidate.password.length()>63||(!candidate.password.isEmpty()&&candidate.password.length()<8)||!validApi(candidate.api)||(!same&&!codeOK)||(candidate.baud!=9600&&candidate.baud!=19200&&candidate.baud!=38400&&candidate.baud!=57600&&candidate.baud!=115200)){jsonReply(422,"Check the WiFi, HTTPS API address, pairing code and serial speed.");return;}
    if(same)candidate.token=config.token;
    else {
      JsonDocument draft;deserializeJson(draft,prefs.getString("pairDraft","{}"));
      if(draft["api"]==candidate.api&&draft["code"]==pairingCode)candidate.token=draft["token"]|"";
      if(candidate.token.length()!=64){candidate.token=randomHex(32);draft["api"]=candidate.api;draft["code"]=pairingCode;draft["token"]=candidate.token;String saved;serializeJson(draft,saved);if(prefs.putString("pairDraft",saved)!=saved.length()){jsonReply(503,"Device storage is unavailable.");return;}}
    }
    configurationPending=true;setupMessage="Connecting. Stay on the setup network until verification completes.";jsonReply(202,setupMessage);
  });
  portal.onNotFound([]{if(!fromSetupNetwork()){portal.send(403);return;}portal.sendHeader("Location","http://192.168.4.1/");portal.send(302,"text/plain","");});
  WiFi.persistent(false);WiFi.setAutoReconnect(true);WiFi.mode(WIFI_STA);printer.begin(config.baud,SERIAL_8N1,PRINTER_RX,PRINTER_TX);
  if(!configured()||!connectVenue(config))startSetup();else setHealth("ready");
}
void loop() {
  if(!storageOK){delay(1000);return;}
  if(digitalRead(SETUP_BUTTON)==LOW){if(!buttonSince)buttonSince=millis();if(!buttonHandled&&millis()-buttonSince>=3000){buttonHandled=true;startSetup();}}
  else {buttonSince=0;buttonHandled=false;}
  if(setupActive){
    dns.processNextRequest();portal.handleClient();if(configurationPending)applyCandidate();
    if((closeSetupAt&&int32_t(millis()-closeSetupAt)>=0)||(!configurationPending&&millis()-setupStarted>900000)){stopSetup();}
  }else if(configured()&&int32_t(millis()-nextPoll)>=0){
    if(WiFi.status()==WL_CONNECTED)pollOrders();else setHealth("wifi_offline");nextPoll=millis()+POLL_MS;
  }
  delay(5);
}
