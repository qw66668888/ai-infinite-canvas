export type AIItem = {
  title: string;
  detail?: string;
  color?: string;
};

export type Settings = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

const SETTINGS_KEY = "ai-infinite-canvas-settings";

const DEFAULTS: Settings = {
  baseUrl:
    (import.meta as any).env?.VITE_OPENAI_BASE_URL ||
    "https://ark.cn-beijing.volces.com/api/v3",
  apiKey: (import.meta as any).env?.VITE_OPENAI_API_KEY || "",
  model:
    (import.meta as any).env?.VITE_OPENAI_MODEL || "doubao-seed-evolving",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

const SYSTEM_PROMPT = `You are a canvas planning assistant.
Turn the user's request into a set of short sticky-note cards for an infinite whiteboard.
Return ONLY valid JSON of the form:
{"items":[{"title":"<=6 words","detail":"one short sentence, optional","color":"one of blue|green|yellow|orange|violet|grey|red"}]}
Rules:
- Return 4 to 10 items.
- Prefer parallel/categorical structure for complex topics; sequential steps for plans.
- Keep each title concise. No markdown.`;

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON: " + text.slice(0, 200));
  }
  return JSON.parse(body.slice(start, end + 1));
}

export async function generateNotes(
  prompt: string,
  s: Settings
): Promise<AIItem[]> {
  const url = s.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(s.apiKey ? { Authorization: `Bearer ${s.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: s.model,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  const items: any[] = Array.isArray(parsed.items) ? parsed.items : [];
  return items
    .filter((i) => i && typeof i.title === "string")
    .map((i) => ({
      title: String(i.title),
      detail: i.detail ? String(i.detail) : undefined,
      color: i.color ? String(i.color) : undefined,
    }));
}
