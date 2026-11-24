import fs from "node:fs";
import path from "node:path";

const logFilePath = process.env.LOG_PATH || "./data/weather.log";
fs.mkdirSync(path.dirname(logFilePath), { recursive: true });

function write(level: "INFO" | "WARN" | "ERROR", message: string): void {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  if (level === "ERROR") {
    console.error(line);
  } else if (level === "WARN") {
    console.warn(line);
  } else {
    console.log(line);
  }
  try {
    fs.appendFileSync(logFilePath, line + "\n", "utf8");
  } catch {
    // Never crash on disk logging failure
  }
}

export const logger = {
  info: (msg: string): void => write("INFO", msg),
  warn: (msg: string): void => write("WARN", msg),
  error: (msg: string): void => write("ERROR", msg),
};
