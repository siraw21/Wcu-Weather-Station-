/*
 * Weather Station Firmware v1.0 — ESP32-WROOM-32
 *
 * HARDWARE & WIRING NOTES:
 * - Board: ESP32-WROOM-32 on DevKitC carrier (3.3 V logic).
 * - ESP32-WROOM-32 has NO 5 V-tolerant inputs; BOTH sensors MUST run at 3.3 V.
 * - The DevKit's onboard 3V3 regulator can power both sensors comfortably.
 * - The DHT11 DATA line requires an external 10 kOhm pull-up resistor to 3V3;
 *   without it, reads fail intermittently.
 * - Keep the module's PCB Wi-Fi antenna clear of metal enclosures and sensors.
 * - Wi-Fi MUST be a 2.4 GHz SSID; the ESP32-WROOM-32 cannot see 5 GHz networks.
 *
 * WIRING:
 *   DHT11              ESP32-WROOM-32
 *   VCC  ----------->  3V3
 *   DATA ----------->  GPIO4 (with 10 kOhm pull-up to 3V3)
 *   GND  ----------->  GND
 *
 *   BMP280 (GY-BMP280) ESP32-WROOM-32
 *   VCC  ----------->  3V3
 *   GND  ----------->  GND
 *   SDA  ----------->  GPIO21
 *   SCL  ----------->  GPIO22
 *   SDO  ----------->  GND (0x76) or 3V3 (0x77)
 *   CSB  ----------->  3V3 (forces I2C mode)
 *
 * BOUNDARY CONTRACT (ESP32 -> Backend):
 *   HTTP POST http://<BACKEND_HOST>:<BACKEND_PORT>/api/readings
 *   Content-Type: application/json
 *   Payload:
 *   {
 *     "deviceId": "ws-01",
 *     "seq": 1,
 *     "ts": 5012,
 *     "temperatureC": 22.4,
 *     "humidityPct": 51.0,
 *     "pressureHpa": 1013.25,
 *     "bmpTemperatureC": 22.8
 *   }
 *   Failed sensor reads are emitted as JSON null, never fabricated numbers.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Adafruit_BMP280.h>

// ============================================================================
// CONFIGURATION BLOCK (compile-time constants — no remote device control)
// ============================================================================
#define WIFI_SSID            "YOUR_2_4GHZ_SSID"
#define WIFI_PASSWORD        "YOUR_WIFI_PASSWORD"
#define BACKEND_HOST         "192.168.1.50"
#define BACKEND_PORT         3000
#define DEVICE_ID            "ws-01"
#define SAMPLING_INTERVAL_MS 5000   // Allowed range: 2000–300000 ms
#define DHT_PIN              4
#define DHT_TYPE             DHT11
#define I2C_SDA              21
#define I2C_SCL              22
#define BMP280_ADDR          0x76   // 0x76 if SDO->GND, 0x77 if SDO->3V3
// ============================================================================

#if SAMPLING_INTERVAL_MS < 2000 || SAMPLING_INTERVAL_MS > 300000
#error "SAMPLING_INTERVAL_MS must be between 2000 and 300000 ms."
#endif

static const uint32_t HTTP_TIMEOUT_MS       = 4000;
static const uint32_t WIFI_CONNECT_STEP_MS  = 500;
static const uint32_t MAX_BACKOFF_MS        = 10000; // Ensures NFR-4 recovery < 60 s

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_BMP280 bmp;

bool bmpAvailable        = false;
uint32_t seqCounter      = 0;
uint32_t lastCycleMs     = 0;
uint32_t backoffMs       = 1000;
uint32_t nextAllowedMs   = 0;

void connectWifiBlocking() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);

  while (WiFi.status() != WL_CONNECTED) {
    delay(WIFI_CONNECT_STEP_MS);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("[WiFi] Connected. IP: ");
  Serial.println(WiFi.localIP());
}

bool ensureWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.println("[WiFi] Disconnected; attempting reconnect...");
  WiFi.disconnect(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < 8000) {
    delay(250);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Reconnected. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("[WiFi] Reconnect failed; backing off.");
  return false;
}

bool initBmp280() {
  if (bmp.begin(BMP280_ADDR)) {
    bmp.setSampling(
      Adafruit_BMP280::MODE_NORMAL,
      Adafruit_BMP280::SAMPLING_X2,
      Adafruit_BMP280::SAMPLING_X16,
      Adafruit_BMP280::FILTER_X16,
      Adafruit_BMP280::STANDBY_MS_500
    );
    Serial.printf("[BMP280] Initialized at 0x%02X\n", BMP280_ADDR);
    return true;
  }
  Serial.printf("[BMP280] Not found at 0x%02X; continuing with null pressure.\n", BMP280_ADDR);
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Weather Station v1.0 (ESP32-WROOM-32) ===");

  Wire.begin(I2C_SDA, I2C_SCL);
  dht.begin();
  bmpAvailable = initBmp280();

  connectWifiBlocking();

  // Trigger first reading immediately in loop()
  lastCycleMs = millis() - SAMPLING_INTERVAL_MS;
}

void loop() {
  const uint32_t now = millis();
  if ((uint32_t)(now - lastCycleMs) < SAMPLING_INTERVAL_MS) {
    return;
  }
  if ((int32_t)(now - nextAllowedMs) < 0) {
    return;
  }
  lastCycleMs = now;

  // 1. Read DHT11 once
  float dhtTemp = dht.readTemperature();
  float dhtHum  = dht.readHumidity();

  // 2. Read BMP280 once (retry init lazily if absent at boot)
  float bmpPressureHpa = NAN;
  float bmpTemp        = NAN;
  if (!bmpAvailable) {
    bmpAvailable = initBmp280();
  }
  if (bmpAvailable) {
    float rawPa = bmp.readPressure();
    float rawT  = bmp.readTemperature();
    if (!isnan(rawPa) && rawPa > 30000.0f && rawPa < 120000.0f) {
      bmpPressureHpa = rawPa / 100.0f;
    }
    if (!isnan(rawT) && rawT > -40.0f && rawT < 85.0f) {
      bmpTemp = rawT;
    }
  }

  // 3. Build JSON payload (failed sensor reads become null)
  seqCounter++;
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["seq"]      = seqCounter;
  doc["ts"]       = now;

  if (!isnan(dhtTemp)) {
    doc["temperatureC"] = roundf(dhtTemp * 10.0f) / 10.0f;
  } else {
    doc["temperatureC"] = nullptr;
  }

  if (!isnan(dhtHum)) {
    doc["humidityPct"] = roundf(dhtHum * 10.0f) / 10.0f;
  } else {
    doc["humidityPct"] = nullptr;
  }

  if (!isnan(bmpPressureHpa)) {
    doc["pressureHpa"] = roundf(bmpPressureHpa * 100.0f) / 100.0f;
  } else {
    doc["pressureHpa"] = nullptr;
  }

  if (!isnan(bmpTemp)) {
    doc["bmpTemperatureC"] = roundf(bmpTemp * 10.0f) / 10.0f;
  } else {
    doc["bmpTemperatureC"] = nullptr;
  }

  String payload;
  serializeJson(doc, payload);

  // 4. Ensure Wi-Fi and POST (no offline buffering — v1 drops failed cycles)
  if (!ensureWifiConnected()) {
    Serial.printf("seq=%lu json=%s outcome=WIFI_OFFLINE backoffMs=%lu\n",
                  (unsigned long)seqCounter, payload.c_str(), (unsigned long)backoffMs);
    nextAllowedMs = millis() + backoffMs;
    backoffMs = min(backoffMs * 2, MAX_BACKOFF_MS);
    return;
  }

  String url = String("http://") + BACKEND_HOST + ":" + String(BACKEND_PORT) + "/api/readings";
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(payload);
  http.end();

  if (httpCode >= 200 && httpCode < 300) {
    backoffMs = 1000;
    nextAllowedMs = 0;
    Serial.printf("seq=%lu json=%s http=%d\n",
                  (unsigned long)seqCounter, payload.c_str(), httpCode);
  } else {
    String errMsg = (httpCode < 0) ? http.errorToString(httpCode) : String(httpCode);
    Serial.printf("seq=%lu json=%s error=%s backoffMs=%lu\n",
                  (unsigned long)seqCounter, payload.c_str(), errMsg.c_str(), (unsigned long)backoffMs);
    nextAllowedMs = millis() + backoffMs;
    backoffMs = min(backoffMs * 2, MAX_BACKOFF_MS);
  }
}
