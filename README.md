# Weather Station with AI Interpretation (v1.0)

Self-contained IoT weather station using an **ESP32-WROOM-32** (DHT11 + BMP280),
a **Node.js + TypeScript** backend with SQLite and WebSockets, a **React + Vite**
web dashboard, and an **Expo** mobile app. Runs completely free on a local laptop
with no MQTT broker, no user accounts, and no paid services.

## 1. Hardware Wiring (ESP32-WROOM-32)

> **Warning:** The ESP32-WROOM-32 uses 3.3 V logic and has **no 5 V-tolerant pins**.
> Power both sensors strictly from `3V3`.

| Sensor | Sensor Pin | ESP32-WROOM-32 Pin | Notes |
|---|---|---|---|
| **DHT11** | VCC | `3V3` | Powered by DevKit 3V3 regulator |
| **DHT11** | DATA | `GPIO4` | Add a **10 kΩ pull-up resistor** between DATA and 3V3 |
| **DHT11** | GND | `GND` | Common ground |
| **BMP280** | VCC | `3V3` | Do NOT connect to 5 V |
| **BMP280** | GND | `GND` | Common ground |
| **BMP280** | SDA | `GPIO21` | I2C Data |
| **BMP280** | SCL | `GPIO22` | I2C Clock |
| **BMP280** | SDO | `GND` (or `3V3`) | `GND` = `0x76` (default), `3V3` = `0x77` |
| **BMP280** | CSB | `3V3` | Forces I2C mode |

Additional hardware notes:
- Use a **2.4 GHz Wi-Fi SSID** (ESP32-WROOM-32 cannot detect 5 GHz bands).
- Keep the ESP32 PCB antenna away from metal enclosures and sensor modules.

## 2. Environment Variables (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP + WebSocket listen port |
| `DB_PATH` | `./data/weather.db` | SQLite database file path |
| `LOG_PATH` | `./data/weather.log` | Plain-text log file |
| `RETENTION_DAYS` | `30` | Automatic pruning threshold for old readings |
| `GEMINI_API_KEY` | *(empty)* | Free API key from Google AI Studio (backend-only) |
| `OPENROUTER_API_KEY` | *(empty)* | Free API key from OpenRouter (backend-only fallback) |
| `LLM_PRIMARY` | `gemini` | Primary provider (`gemini` or `openrouter`) |
| `LLM_FALLBACK` | `openrouter` | Secondary provider if primary fails/rate-limits |

If neither API key is set, the station still operates fully and `/api/interpret`
returns the deterministic rule-based summary flagged as **Not AI generated**.

## 3. Run the Backend

Requires **Node.js 20+**.

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Verify the server is listening on `http://<YOUR_LAPTOP_LAN_IP>:3000`. Ensure your
laptop firewall allows inbound TCP traffic on port `3000` from the local Wi-Fi network.

## 4. Flash the ESP32-WROOM-32 Firmware

1. Open `firmware/weather_station/weather_station.ino` and update:
   - `WIFI_SSID` and `WIFI_PASSWORD` (2.4 GHz network)
   - `BACKEND_HOST` (your laptop's LAN IPv4 address)
   - `BMP280_ADDR` (`0x76` or `0x77`)
2. Flash via **PlatformIO** (`cd firmware && pio run -t upload && pio device monitor -b 115200`)
   or **Arduino IDE** (Board: `ESP32 Dev Module`, Upload Speed `921600`, Partition `Default 4MB with spiffs`, Serial `115200`).

## 5. Run the Web Dashboard

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. To serve the web app from the single backend Node
process on port `3000`, run `npm run build` inside `web/` and restart the backend.

## 6. Run the Mobile App (Expo)

1. Edit `mobile/src/config.ts` and set `BACKEND_HTTP_URL` and `BACKEND_WS_URL`
   to your laptop's LAN IPv4 address.
2. Start Expo:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
3. Open on an Android device on the same Wi-Fi network using the Expo Go or
   Expo development client.
