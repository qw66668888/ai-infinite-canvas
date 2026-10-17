export type AIItem = {
  title: string;
  detail?: string;
  color?: string;
  parent?: number;
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

const SYSTEM_PROMPT = `你是一个无限白板规划助手。把用户的需求拆解成一组简短的便签卡片，并标出卡片之间的从属/依赖关系。
只返回合法 JSON，格式严格如下：
{"items":[{"title":"不超过12个汉字的短标题","detail":"一句话补充说明，可选","color":"blue|green|yellow|orange|violet|grey|red 其中之一","parent":1}]}
规则：
- 返回 4 到 10 张卡片。
- 复杂主题按类别/模块并列展开；计划类需求按先后步骤展开。
- parent 是“父卡片”的序号（从 1 开始，必须是更早出现的卡片），用于自动连线；没有从属关系就省略该字段。
- 不要形成环，每个卡片最多一个 parent。
- 标题和 detail 一律使用简体中文，精炼，不要使用 Markdown。`;

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型没有返回 JSON：" + text.slice(0, 200));
  }
  return JSON.parse(body.slice(start, end + 1));
}

function endpoint(s: Settings) {
  return s.baseUrl.replace(/\/$/, "") + "/chat/completions";
}

function headers(s: Settings) {
  return {
    "Content-Type": "application/json",
    ...(s.apiKey ? { Authorization: `Bearer ${s.apiKey}` } : {}),
  };
}

export async function generateNotes(
  prompt: string,
  s: Settings
): Promise<AIItem[]> {
  const res = await fetch(endpoint(s), {
    method: "POST",
    headers: headers(s),
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
    throw new Error(`HTTP ${res.status}：${detail.slice(0, 300)}`);
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
      parent:
        typeof i.parent === "number" && Number.isFinite(i.parent)
          ? Math.floor(i.parent)
          : undefined,
    }));
}

export async function rewriteText(
  text: string,
  instruction: string,
  s: Settings
): Promise<string> {
  const res = await fetch(endpoint(s), {
    method: "POST",
    headers: headers(s),
    body: JSON.stringify({
      model: s.model,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "你是专业的中文文字编辑。只输出改写后的纯文本，不要解释，不要 Markdown 代码块。",
        },
        { role: "user", content: `${instruction}\n\n原文：\n${text}` },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}：${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  return content.trim();
}