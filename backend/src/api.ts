import express, { Router } from "express";
import { z } from "zod";
import { WeatherDb } from "./db";
import { WeatherWsHub } from "./ws";
import { buildStationFacts, computeIndicators } from "./facts";
import { buildRuleBasedFallback } from "./fallback";
import { answerStationQuestion, generateInterpretation } from "./llm";
import { logger } from "./logger";
import { AskResponse, InterpretResponse } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Validation boundary schemas (strict runtime verification for ESP32 & client inputs)
const readingBodySchema = z.object({
  deviceId: z.string().trim().min(1, "deviceId must be a non-empty string"),
  seq: z.number().finite(),
  ts: z.number().finite(),
  temperatureC: z.number().finite().nullable(),
  humidityPct: z.number().finite().nullable(),
  pressureHpa: z.number().finite().nullable(),
  bmpTemperatureC: z.number().finite().nullable(),
});

const interpretBodySchema = z.object({
  deviceId: z.string().trim().min(1).optional(),
});

const askBodySchema = z.object({
  deviceId: z.string().trim().min(1).optional(),
  question: z.string().trim().min(1, "question is required").max(500),
});

function parseIsoParam(raw: unknown, fallbackMs: number): string | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    return new Date(fallbackMs).toISOString();
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

export function createApiRouter(db: WeatherDb, wsHub: WeatherWsHub): Router {
  const router = express.Router();

  /**
   * POST /api/readings — Ingestion endpoint for ESP32-WROOM-32 HTTP POSTs.
   */
  router.post("/readings", (req, res) => {
    const parsed = readingBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const reason = parsed.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      logger.warn(`POST /api/readings REJECTED reason="${reason}"`);
      res.status(400).json({ ok: false, error: reason });
      return;
    }

    const receivedAt = new Date().toISOString();
    const { reading, becameOnline, device } = db.insertReading({
      deviceId: parsed.data.deviceId,
      receivedAt,
      seq: Math.trunc(parsed.data.seq),
      temperatureC: parsed.data.temperatureC,
      humidityPct: parsed.data.humidityPct,
      pressureHpa: parsed.data.pressureHpa,
      bmpTemperatureC: parsed.data.bmpTemperatureC,
    });

    logger.info(
      `POST /api/readings device=${reading.deviceId} seq=${reading.seq} outcome=200`
    );

    if (becameOnline) {
      logger.info(
        `Device transition device=${device.deviceId} state=ONLINE lastSeen=${device.lastSeen}`
      );
      wsHub.broadcast({
        type: "device",
        deviceId: device.deviceId,
        online: true,
        lastSeen: device.lastSeen,
      });
    }

    wsHub.broadcast({ type: "reading", reading });
    res.status(200).json({ ok: true });
  });

  /**
   * GET /api/readings/latest
   */
  router.get("/readings/latest", (req, res) => {
    const requestedId =
      typeof req.query.deviceId === "string" && req.query.deviceId.trim() !== ""
        ? req.query.deviceId.trim()
        : db.getDefaultDeviceId() ?? undefined;

    const reading = db.getLatestReading(requestedId);
    const device = db.getDeviceStatus(requestedId);

    if (!reading && !device) {
      res.status(204).end();
      return;
    }

    res.json({ reading, device });
  });

  /**
   * GET /api/readings/export?from=<iso>&to=<iso>
   */
  router.get("/readings/export", (req, res) => {
    const now = Date.now();
    const fromIso = parseIsoParam(req.query.from, now - 24 * 60 * 60 * 1000);
    const toIso = parseIsoParam(req.query.to, now);
    if (!fromIso || !toIso) {
      res.status(400).json({ ok: false, error: "Invalid ISO timestamp in from/to" });
      return;
    }

    const deviceId =
      typeof req.query.deviceId === "string" && req.query.deviceId.trim() !== ""
        ? req.query.deviceId.trim()
        : undefined;

    const rows = db.getRawReadingsInRange(fromIso, toIso, deviceId);
    if (rows.length === 0) {
      res.status(204).end();
      return;
    }

    const lines = ["time,temperatureC,humidityPct,pressureHpa"];
    for (const r of rows) {
      lines.push(
        [
          r.receivedAt,
          r.temperatureC ?? "",
          r.humidityPct ?? "",
          r.pressureHpa ?? "",
        ].join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="weather-${fromIso.slice(0, 10)}-to-${toIso.slice(0, 10)}.csv"`
    );
    res.status(200).send(lines.join("\n") + "\n");
  });

  /**
   * GET /api/readings?from=<iso>&to=<iso>&bucket=<seconds>
   */
  router.get("/readings", (req, res) => {
    const now = Date.now();
    const fromIso = parseIsoParam(req.query.from, now - 60 * 60 * 1000);
    const toIso = parseIsoParam(req.query.to, now);
    if (!fromIso || !toIso) {
      res.status(400).json({ ok: false, error: "Invalid ISO timestamp in from/to" });
      return;
    }

    const rawBucket = typeof req.query.bucket === "string" ? Number(req.query.bucket) : 60;
    const bucketSec = Number.isFinite(rawBucket) && rawBucket > 0 ? rawBucket : 60;
    const deviceId =
      typeof req.query.deviceId === "string" && req.query.deviceId.trim() !== ""
        ? req.query.deviceId.trim()
        : undefined;

    const points = db.getBucketedReadings(fromIso, toIso, bucketSec, deviceId);
    res.json(points);
  });

  /**
   * GET /api/indicators
   */
  router.get("/indicators", (req, res) => {
    const deviceId =
      typeof req.query.deviceId === "string" && req.query.deviceId.trim() !== ""
        ? req.query.deviceId.trim()
        : db.getDefaultDeviceId() ?? undefined;

    const indicators = computeIndicators(db, deviceId);
    res.json(indicators);
  });

  /**
   * GET /api/device/status
   */
  router.get("/device/status", (req, res) => {
    const deviceId =
      typeof req.query.deviceId === "string" && req.query.deviceId.trim() !== ""
        ? req.query.deviceId.trim()
        : db.getDefaultDeviceId() ?? undefined;

    const status = db.getDeviceStatus(deviceId);
    if (!status) {
      res.json({ online: false, lastSeen: null, intervalSeconds: 5 });
      return;
    }
    res.json(status);
  });

  /**
   * POST /api/interpret — Cached (5 min) LLM interpretation with rule-based fallback.
   */
  router.post("/interpret", async (req, res) => {
    const parsed = interpretBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid request body" });
      return;
    }

    const deviceId = parsed.data.deviceId || db.getDefaultDeviceId() || "ws-01";

    const cached = db.getLatestCachedInterpretation(deviceId, CACHE_TTL_MS);
    if (cached) {
      logger.info(`LLM call model=${cached.model} latency=0ms cached=true device=${deviceId}`);
      const payload: InterpretResponse = {
        available: true,
        text: cached.text,
        model: cached.model,
        createdAt: cached.created_at,
        cached: true,
      };
      res.status(200).json(payload);
      return;
    }

    const facts = buildStationFacts(db, deviceId);

    try {
      const result = await generateInterpretation(facts);
      const createdAt = new Date().toISOString();
      db.insertInterpretation({
        deviceId,
        inputFacts: JSON.stringify(facts),
        text: result.text,
        model: result.model,
        createdAt,
      });

      const payload: InterpretResponse = {
        available: true,
        text: result.text,
        model: result.model,
        createdAt,
        cached: false,
      };
      res.status(200).json(payload);
    } catch {
      const fallback = buildRuleBasedFallback(facts);
      const payload: InterpretResponse = {
        available: false,
        message: "Interpretation service unavailable.",
        fallback,
        fallbackIsAI: false,
      };
      res.status(200).json(payload);
    }
  });

  /**
   * POST /api/ask — Question answering strictly scoped to station facts.
   */
  router.post("/ask", async (req, res) => {
    const parsed = askBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const reason = parsed.error.issues.map((i) => i.message).join("; ");
      res.status(400).json({ ok: false, error: reason });
      return;
    }

    const deviceId = parsed.data.deviceId || db.getDefaultDeviceId() || "ws-01";
    const facts = buildStationFacts(db, deviceId);

    try {
      const result = await answerStationQuestion(facts, parsed.data.question);
      const payload: AskResponse = {
        available: true,
        text: result.text,
        model: result.model,
        createdAt: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch {
      const payload: AskResponse = {
        available: false,
        message: "Interpretation service unavailable.",
      };
      res.status(200).json(payload);
    }
  });

  return router;
}
