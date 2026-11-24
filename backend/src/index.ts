import "dotenv/config";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import cors from "cors";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import express, { NextFunction, Request, Response } from "express";
import { WeatherDb } from "./db";
import { createApiRouter } from "./api";
import { WeatherWsHub } from "./ws";
import { startOfflineMonitor } from "./status";
import { logger } from "./logger";

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || "./data/weather.db";
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 30);

const app = express();
app.use(cors());
app.use(express.json({ limit: "64kb" }));

// Catch malformed JSON payloads cleanly without crashing the process
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    logger.warn(`Malformed JSON on ${req.method} ${req.path}: ${err.message}`);
    res.status(400).json({ ok: false, error: "Malformed JSON body" });
    return;
  }
  next(err);
});

const db = new WeatherDb(DB_PATH);
db.pruneOldReadings(RETENTION_DAYS);

const server = http.createServer(app);
const wsHub = new WeatherWsHub(server, db);

app.use("/api", createApiRouter(db, wsHub));

// Serve the built web dashboard bundle when present (single-process deployment)
const webDistDir = path.resolve(__dirname, "../../web/dist");
if (fs.existsSync(webDistDir)) {
  app.use(express.static(webDistDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webDistDir, "index.html"));
  });
}

// Background tasks: offline detection (every 5 s) and retention cleanup (hourly)
const offlineTimer = startOfflineMonitor(db, wsHub);
const retentionTimer = setInterval(
  () => {
    db.pruneOldReadings(RETENTION_DAYS);
  },
  60 * 60 * 1000,
);

server.listen(PORT, "0.0.0.0", () => {
  logger.info(`Weather Station backend listening on http://0.0.0.0:${PORT}`);
});

function shutdown(): void {
  logger.info("Shutting down backend...");
  clearInterval(offlineTimer);
  clearInterval(retentionTimer);
  wsHub.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
