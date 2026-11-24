import { StationFacts } from "./types";

function formatAge(seconds: number | null): string {
  if (seconds === null) return "never";
  if (seconds < 60) return `${seconds} seconds ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
}

function describeComfort(tempC: number | null, rh: number | null): string {
  if (tempC === null && rh === null) {
    return "Temperature and humidity readings are currently missing.";
  }

  const parts: string[] = [];
  if (tempC !== null) parts.push(`Temperature is ${tempC.toFixed(1)} °C`);
  if (rh !== null) parts.push(`humidity is ${rh.toFixed(0)} %`);

  let qualifier = "within a typical indoor range";
  if (tempC !== null && tempC >= 27) {
    qualifier = "warm";
  } else if (tempC !== null && tempC <= 17) {
    qualifier = "cool";
  } else if (rh !== null && rh >= 65) {
    qualifier = "humid";
  } else if (rh !== null && rh <= 30) {
    qualifier = "dry";
  } else if (tempC !== null && rh !== null) {
    qualifier = "comfortable";
  }

  return `${parts.join(" and ")}, which feels ${qualifier}.`;
}

function describePressure(facts: StationFacts): string {
  const { deltaHpa3h, pressureTendency } = facts.indicators;
  const latestP = facts.latestReading?.pressureHpa ?? null;

  if (latestP === null) {
    return "Barometric pressure data is unavailable right now.";
  }
  if (deltaHpa3h === null) {
    return `Barometric pressure is ${latestP.toFixed(1)} hPa with insufficient history for a 3-hour trend.`;
  }
  if (pressureTendency === "falling") {
    return `Pressure is ${latestP.toFixed(1)} hPa and fell ${Math.abs(deltaHpa3h).toFixed(1)} hPa over the last 3 hours, which sometimes precedes unsettled weather.`;
  }
  if (pressureTendency === "rising") {
    return `Pressure is ${latestP.toFixed(1)} hPa and rose ${deltaHpa3h.toFixed(1)} hPa over the last 3 hours, which often aligns with calmer conditions.`;
  }
  return `Pressure is steady at ${latestP.toFixed(1)} hPa (change of ${deltaHpa3h.toFixed(1)} hPa over 3 hours).`;
}

function suggestAction(facts: StationFacts): string {
  if (!facts.device.online) {
    return "Check the weather station power and 2.4 GHz Wi-Fi connection before relying on these values.";
  }
  const t = facts.latestReading?.temperatureC ?? null;
  const h = facts.latestReading?.humidityPct ?? null;
  if (h !== null && h >= 65) {
    return "Consider ventilating the room or running a dehumidifier to lower indoor humidity.";
  }
  if (h !== null && h <= 30) {
    return "Indoor air is dry; a bowl of water or a humidifier can improve comfort.";
  }
  if (t !== null && t >= 26) {
    return "Opening a window or turning on a fan can help cool the room.";
  }
  if (t !== null && t <= 18) {
    return "Closing drafts or adding a light layer will keep the space comfortable.";
  }
  return "Current indoor conditions are balanced; no immediate adjustment is needed.";
}

/**
 * Deterministic, rule-based summary used when all LLM providers fail.
 */
export function buildRuleBasedFallback(facts: StationFacts): string {
  if (!facts.latestReading) {
    return "No readings have been recorded for this weather station yet. Check that the ESP32 is powered and posting to the backend.";
  }

  const sentences: string[] = [
    describeComfort(facts.latestReading.temperatureC, facts.latestReading.humidityPct),
    describePressure(facts),
    facts.device.online
      ? `The sensor last reported ${formatAge(facts.device.secondsSinceLastSeen)}.`
      : `Note: the device is currently offline (last seen ${formatAge(facts.device.secondsSinceLastSeen)}).`,
    suggestAction(facts),
  ];

  return sentences.join(" ");
}
