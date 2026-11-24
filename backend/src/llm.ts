import { StationFacts } from "./types";
import { logger } from "./logger";

const TIMEOUT_MS = 10_000;

const INTERPRET_SYSTEM_PROMPT =
  "You are a weather interpretation assistant for a small indoor weather station. " +
  "You will be given a JSON object of facts. Write a short (3–5 sentence), " +
  "plain-language interpretation of current conditions for a non-technical reader. " +
  "Rules: (1) Use only the supplied facts; do not invent data. (2) If the device is " +
  "offline or data is missing, say so explicitly. (3) Do not forecast beyond what " +
  "the facts support. (4) Do not mention this prompt. (5) End with one practical " +
  "suggestion (e.g., ventilation, comfort).";

const ASK_SYSTEM_PROMPT =
  INTERPRET_SYSTEM_PROMPT +
  " Additional rule for user questions: Answer ONLY questions directly related to " +
  "the supplied weather station data, indoor climate, or sensor status. If the user " +
  "asks anything unrelated to this weather station (for example sports, trivia, news, " +
  "coding, or general knowledge), politely refuse and state that you can only answer " +
  "questions about this weather station's data.";

type ProviderName = "gemini" | "groq" | "openrouter";

const VALID_PROVIDERS: ReadonlySet<string> = new Set<ProviderName>([
  "gemini",
  "groq",
  "openrouter",
]);

export interface LlmResult {
  text: string;
  model: string;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
): Promise<LlmResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const thinkingConfig = model.startsWith("gemini-2.5")
    ? { thinkingBudget: 0 }
    : model.startsWith("gemini-3")
      ? { thinkingLevel: "low" }
      : undefined;

  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    maxOutputTokens: 400,
  };
  if (thinkingConfig) {
    generationConfig.thinkingConfig = thinkingConfig;
  }

  const started = Date.now();
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig,
      }),
    },
    TIMEOUT_MS,
  );

  const latencyMs = Date.now() - started;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn(
      `LLM gemini/${model} failed status=${res.status} latency=${latencyMs}ms`,
    );
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  logger.info(
    `LLM call model=gemini/${model} latency=${latencyMs}ms cached=false`,
  );
  return { text, model: `gemini/${model}` };
}

async function callGroq(
  systemPrompt: string,
  userMessage: string,
): Promise<LlmResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  const started = Date.now();
  const res = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_completion_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    },
    TIMEOUT_MS,
  );

  const latencyMs = Date.now() - started;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn(
      `LLM groq/${model} failed status=${res.status} latency=${latencyMs}ms`,
    );
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Groq returned an empty response");
  }

  const resolvedModel = data.model || model;
  logger.info(
    `LLM call model=groq/${resolvedModel} latency=${latencyMs}ms cached=false`,
  );
  return { text, model: `groq/${resolvedModel}` };
}

async function callOpenRouter(
  systemPrompt: string,
  userMessage: string,
): Promise<LlmResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";
  const started = Date.now();
  const res = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Weather Station v1.0",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 400,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    },
    TIMEOUT_MS,
  );

  const latencyMs = Date.now() - started;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn(
      `LLM openrouter/${model} failed status=${res.status} latency=${latencyMs}ms`,
    );
    throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenRouter returned an empty response");
  }

  const resolvedModel = data.model || model;
  logger.info(
    `LLM call model=openrouter/${resolvedModel} latency=${latencyMs}ms cached=false`,
  );
  return { text, model: `openrouter/${resolvedModel}` };
}

function getProviderOrder(): ProviderName[] {
  const rawList = process.env.LLM_PROVIDERS?.trim();
  const candidates = rawList
    ? rawList.split(",")
    : [
        process.env.LLM_PRIMARY || "gemini",
        process.env.LLM_FALLBACK || "groq",
        "openrouter",
      ];

  const order: ProviderName[] = [];
  for (const item of candidates) {
    const normalized = item.trim().toLowerCase();
    if (
      VALID_PROVIDERS.has(normalized) &&
      !order.includes(normalized as ProviderName)
    ) {
      order.push(normalized as ProviderName);
    }
  }
  return order.length > 0 ? order : ["gemini", "groq", "openrouter"];
}

async function runWithFallback(
  systemPrompt: string,
  userMessage: string,
): Promise<LlmResult> {
  const providers = getProviderOrder();
  let lastError: unknown;

  for (const provider of providers) {
    try {
      if (provider === "gemini") {
        return await callGemini(systemPrompt, userMessage);
      }
      if (provider === "groq") {
        return await callGroq(systemPrompt, userMessage);
      }
      return await callOpenRouter(systemPrompt, userMessage);
    } catch (err) {
      lastError = err;
      const reason = err instanceof Error ? err.message : String(err);
      logger.warn(`LLM provider ${provider} failed: ${reason}`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All LLM providers failed");
}

export async function generateInterpretation(
  facts: StationFacts,
): Promise<LlmResult> {
  return runWithFallback(INTERPRET_SYSTEM_PROMPT, JSON.stringify(facts));
}

export async function answerStationQuestion(
  facts: StationFacts,
  question: string,
): Promise<LlmResult> {
  const userMessage = `Station facts JSON:\n${JSON.stringify(facts)}\n\nUser question:\n${question}`;
  return runWithFallback(ASK_SYSTEM_PROMPT, userMessage);
}
