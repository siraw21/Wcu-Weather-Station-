import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { BucketedReading, DeviceStatus, ReadingRecord } from "./types";
import { logger } from "./logger";

interface ReadingRow {
  id: number;
  device_id: string;
  received_at: string;
  seq: number;
  temperature_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  bmp_temperature_c: number | null;
}

interface DeviceStateRow {
  device_id: string;
  online: number;
  last_seen: string;
  interval_seconds: number;
}

interface InterpretationRow {
  id: number;
  device_id: string;
  input_facts: string;
  text: string;
  model: string;
  created_at: string;
}

interface BucketRow {
  bucket_epoch: number;
  temperature_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  bmp_temperature_c: number | null;
}

export class WeatherDb {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        received_at TEXT NOT NULL,
        seq INTEGER NOT NULL,
        temperature_c REAL,
        humidity_pct REAL,
        pressure_hpa REAL,
        bmp_temperature_c REAL
      );

      CREATE TABLE IF NOT EXISTS device_state (
        device_id TEXT PRIMARY KEY,
        online INTEGER NOT NULL,
        last_seen TEXT NOT NULL,
        interval_seconds INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS interpretations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        input_facts TEXT NOT NULL,
        text TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_readings_device_received
        ON readings (device_id, received_at);

      CREATE INDEX IF NOT EXISTS idx_interpretations_device_created
        ON interpretations (device_id, created_at);
    `);
  }

  private mapReading(row: ReadingRow): ReadingRecord {
    return {
      id: row.id,
      deviceId: row.device_id,
      receivedAt: row.received_at,
      seq: row.seq,
      temperatureC: row.temperature_c,
      humidityPct: row.humidity_pct,
      pressureHpa: row.pressure_hpa,
      bmpTemperatureC: row.bmp_temperature_c,
    };
  }

  private mapDevice(row: DeviceStateRow): DeviceStatus {
    return {
      deviceId: row.device_id,
      online: row.online === 1,
      lastSeen: row.last_seen,
      intervalSeconds: row.interval_seconds,
    };
  }

  public insertReading(input: {
    deviceId: string;
    receivedAt: string;
    seq: number;
    temperatureC: number | null;
    humidityPct: number | null;
    pressureHpa: number | null;
    bmpTemperatureC: number | null;
  }): { reading: ReadingRecord; becameOnline: boolean; device: DeviceStatus } {
    const existingDevice = this.getDeviceStatus(input.deviceId);
    let intervalSeconds = existingDevice?.intervalSeconds ?? 5;

    // Infer real sampling interval smoothly when consecutive readings arrive within 2–300 s
    if (existingDevice) {
      const deltaSec = Math.round(
        (Date.parse(input.receivedAt) - Date.parse(existingDevice.lastSeen)) / 1000
      );
      if (deltaSec >= 2 && deltaSec <= 300) {
        intervalSeconds = deltaSec;
      }
    }

    const insertStmt = this.db.prepare(`
      INSERT INTO readings (
        device_id, received_at, seq, temperature_c, humidity_pct, pressure_hpa, bmp_temperature_c
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const upsertDeviceStmt = this.db.prepare(`
      INSERT INTO device_state (device_id, online, last_seen, interval_seconds)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        online = 1,
        last_seen = excluded.last_seen,
        interval_seconds = excluded.interval_seconds
    `);

    const tx = this.db.transaction(() => {
      const info = insertStmt.run(
        input.deviceId,
        input.receivedAt,
        input.seq,
        input.temperatureC,
        input.humidityPct,
        input.pressureHpa,
        input.bmpTemperatureC
      );
      upsertDeviceStmt.run(input.deviceId, input.receivedAt, intervalSeconds);
      return Number(info.lastInsertRowid);
    });

    const newId = tx();
    const reading: ReadingRecord = {
      id: newId,
      ...input,
    };

    const device: DeviceStatus = {
      deviceId: input.deviceId,
      online: true,
      lastSeen: input.receivedAt,
      intervalSeconds,
    };

    const becameOnline = !existingDevice || !existingDevice.online;
    return { reading, becameOnline, device };
  }

  public getDefaultDeviceId(): string | null {
    const row = this.db
      .prepare("SELECT device_id FROM device_state ORDER BY last_seen DESC LIMIT 1")
      .get() as { device_id: string } | undefined;
    return row?.device_id ?? null;
  }

  public getLatestReading(deviceId?: string): ReadingRecord | null {
    const row = deviceId
      ? (this.db
          .prepare("SELECT * FROM readings WHERE device_id = ? ORDER BY received_at DESC, id DESC LIMIT 1")
          .get(deviceId) as ReadingRow | undefined)
      : (this.db
          .prepare("SELECT * FROM readings ORDER BY received_at DESC, id DESC LIMIT 1")
          .get() as ReadingRow | undefined);

    return row ? this.mapReading(row) : null;
  }

  public getDeviceStatus(deviceId?: string): DeviceStatus | null {
    const row = deviceId
      ? (this.db
          .prepare("SELECT * FROM device_state WHERE device_id = ?")
          .get(deviceId) as DeviceStateRow | undefined)
      : (this.db
          .prepare("SELECT * FROM device_state ORDER BY last_seen DESC LIMIT 1")
          .get() as DeviceStateRow | undefined);

    return row ? this.mapDevice(row) : null;
  }

  public getAllOnlineDevices(): DeviceStatus[] {
    const rows = this.db
      .prepare("SELECT * FROM device_state WHERE online = 1")
      .all() as DeviceStateRow[];
    return rows.map((r) => this.mapDevice(r));
  }

  public markDeviceOffline(deviceId: string): void {
    this.db
      .prepare("UPDATE device_state SET online = 0 WHERE device_id = ?")
      .run(deviceId);
  }

  public getRawReadingsInRange(fromIso: string, toIso: string, deviceId?: string): ReadingRecord[] {
    const rows = deviceId
      ? (this.db
          .prepare(
            "SELECT * FROM readings WHERE device_id = ? AND received_at >= ? AND received_at <= ? ORDER BY received_at ASC"
          )
          .all(deviceId, fromIso, toIso) as ReadingRow[])
      : (this.db
          .prepare(
            "SELECT * FROM readings WHERE received_at >= ? AND received_at <= ? ORDER BY received_at ASC"
          )
          .all(fromIso, toIso) as ReadingRow[]);

    return rows.map((r) => this.mapReading(r));
  }

  /**
   * Returns readings averaged per time bucket, guaranteeing at most ~500 points.
   */
  public getBucketedReadings(
    fromIso: string,
    toIso: string,
    requestedBucketSec: number,
    deviceId?: string
  ): BucketedReading[] {
    const spanSec = Math.max(1, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 1000));
    const minBucketForCap = Math.max(1, Math.ceil(spanSec / 500));
    const bucketSec = Math.max(1, Math.floor(requestedBucketSec), minBucketForCap);

    const query = deviceId
      ? `
        SELECT
          (CAST(strftime('%s', received_at) AS INTEGER) / ?) * ? AS bucket_epoch,
          AVG(temperature_c) AS temperature_c,
          AVG(humidity_pct) AS humidity_pct,
          AVG(pressure_hpa) AS pressure_hpa,
          AVG(bmp_temperature_c) AS bmp_temperature_c
        FROM readings
        WHERE device_id = ? AND received_at >= ? AND received_at <= ?
        GROUP BY bucket_epoch
        ORDER BY bucket_epoch ASC
      `
      : `
        SELECT
          (CAST(strftime('%s', received_at) AS INTEGER) / ?) * ? AS bucket_epoch,
          AVG(temperature_c) AS temperature_c,
          AVG(humidity_pct) AS humidity_pct,
          AVG(pressure_hpa) AS pressure_hpa,
          AVG(bmp_temperature_c) AS bmp_temperature_c
        FROM readings
        WHERE received_at >= ? AND received_at <= ?
        GROUP BY bucket_epoch
        ORDER BY bucket_epoch ASC
      `;

    const rows = (
      deviceId
        ? this.db.prepare(query).all(bucketSec, bucketSec, deviceId, fromIso, toIso)
        : this.db.prepare(query).all(bucketSec, bucketSec, fromIso, toIso)
    ) as BucketRow[];

    const round = (val: number | null, digits: number): number | null => {
      if (val === null || !Number.isFinite(val)) return null;
      const factor = 10 ** digits;
      return Math.round(val * factor) / factor;
    };

    return rows.map((row) => ({
      time: new Date(row.bucket_epoch * 1000).toISOString(),
      temperatureC: round(row.temperature_c, 2),
      humidityPct: round(row.humidity_pct, 2),
      pressureHpa: round(row.pressure_hpa, 2),
      bmpTemperatureC: round(row.bmp_temperature_c, 2),
    }));
  }

  public getLatestCachedInterpretation(deviceId: string, maxAgeMs: number): InterpretationRow | null {
    const cutoffIso = new Date(Date.now() - maxAgeMs).toISOString();
    const row = this.db
      .prepare(
        `SELECT * FROM interpretations
         WHERE device_id = ? AND created_at >= ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(deviceId, cutoffIso) as InterpretationRow | undefined;

    return row ?? null;
  }

  public insertInterpretation(entry: {
    deviceId: string;
    inputFacts: string;
    text: string;
    model: string;
    createdAt: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO interpretations (device_id, input_facts, text, model, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(entry.deviceId, entry.inputFacts, entry.text, entry.model, entry.createdAt);
  }

  public pruneOldReadings(retentionDays: number): number {
    const cutoffIso = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const result = this.db
      .prepare("DELETE FROM readings WHERE received_at < ?")
      .run(cutoffIso);
    if (result.changes > 0) {
      logger.info(`Retention cleanup deleted ${result.changes} readings older than ${retentionDays} days.`);
    }
    return result.changes;
  }

  public close(): void {
    this.db.close();
  }
}
