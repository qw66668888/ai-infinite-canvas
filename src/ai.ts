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
  imageModel: string;
};

const SETTINGS_KEY = "ai-infinite-canvas-settings";

export const IMAGE_MODEL_PRESETS = [
  { id: "doubao-seedream-5-0-flash-260915", label: "Doubao-Seedream-5.0-flash" },
  { id: "doubao-seedream-5-0-pro-260628", label: "Doubao-Seedream-5.0-pro" },
  { id: "doubao-seededit-3-0-i2i-250628", label: "Doubao-SeedEdit-3.0-i2i" },
];

const DEFAULTS: Settings = {
  baseUrl:
    (import.meta as any).env?.VITE_OPENAI_BASE_URL ||
    "https://ark.cn-beijing.volces.com/api/v3",
  apiKey: (import.meta as any).env?.VITE_OPENAI_API_KEY || "",
  model:
    (import.meta as any).env?.VITE_OPENAI_MODEL ||
    "doubao-seed-2-1-lite-260915",
  imageModel:
    (import.meta as any).env?.VITE_IMAGE_MODEL ||
    "doubao-seedream-5-0-flash-260915",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const merged = { ...DEFAULTS, ...saved };
      // 兼容旧版本：旧设置没有 imageModel，且默认文本模型已经失效。
      if (!saved?.imageModel) merged.imageModel = DEFAULTS.imageModel;
      if (!saved?.model || saved.model === "doubao-seed-evolving") {
        merged.model = DEFAULTS.model;
      }
      return merged;
    }
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

function apiBase(s: Settings) {
  return s.baseUrl.replace(/\/$/, "");
}

function chatEndpoint(s: Settings) {
  return apiBase(s) + "/chat/completions";
}

function imageEndpoint(s: Settings) {
  return apiBase(s) + "/images/generations";
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
  const res = await fetch(chatEndpoint(s), {
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
  const res = await fetch(chatEndpoint(s), {
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

type ImageAttempt = {
  body: any;
  label: string;
};

function readableApiError(status: number, text: string) {
  try {
    const parsed = JSON.parse(text);
    const error = parsed?.error ?? parsed;
    const code = error?.code ? `[${error.code}] ` : "";
    const message = error?.message || text;
    return `HTTP ${status}：${code}${String(message).slice(0, 500)}`;
  } catch {
    return `HTTP ${status}：${text.slice(0, 500) || "服务端没有返回错误详情"}`;
  }
}

function imageFromResponse(data: any): string | null {
  const list = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.images)
    ? data.images
    : data?.data
    ? [data.data]
    : [];

  for (const item of list) {
    if (typeof item === "string" && item) {
      return item.startsWith("http") || item.startsWith("data:")
        ? item
        : `data:image/png;base64,${item}`;
    }
    if (item?.b64_json) {
      return `data:${item.mime_type || "image/png"};base64,${item.b64_json}`;
    }
    if (item?.base64) {
      return `data:${item.mime_type || "image/png"};base64,${item.base64}`;
    }
    if (item?.url) return String(item.url);
  }
  return null;
}

export async function editImage(
  imageDataUrl: string | string[],
  prompt: string,
  s: Settings,
  size = "adaptive"
): Promise<string> {
  if (!s.imageModel) {
    throw new Error("请先在 ⚙ 设置里填写图生图模型（SeedEdit / Seedream 的接入点 ID）。");
  }

  const rawInputs = Array.isArray(imageDataUrl) ? imageDataUrl : [imageDataUrl];
  const dataUrls = rawInputs.filter(Boolean).map((input) =>
    input.startsWith("data:")
      ? input
      : input.startsWith("http")
      ? input
      : `data:image/jpeg;base64,${input}`
  );
  if (dataUrls.length === 0) {
    throw new Error("这个提示词节点没有连接可用的参考图片。");
  }
  const imageValue = dataUrls.length === 1 ? dataUrls[0] : dataUrls;
  const rawBase64 = dataUrls[0].includes(",")
    ? dataUrls[0].split(",")[1]
    : dataUrls[0];
  const selectedSize = size || "adaptive";
  const fallbackSize = selectedSize === "adaptive" ? "2K" : "adaptive";

  const attempts: ImageAttempt[] = [
    {
      label: "Seedream 图片编辑",
      body: {
        model: s.imageModel,
        prompt,
        image: imageValue,
        size: selectedSize,
        response_format: "url",
        watermark: false,
      },
    },
    {
      label: "Seedream 备用尺寸",
      body: {
        model: s.imageModel,
        prompt,
        image: imageValue,
        size: fallbackSize,
        response_format: "url",
        watermark: false,
      },
    },
    {
      label: "Seedream 多图输入格式",
      body: {
        model: s.imageModel,
        prompt,
        image: dataUrls.length === 1 ? [dataUrls[0]] : dataUrls[0],
        size: fallbackSize,
        response_format: "url",
        watermark: false,
      },
    },
    {
      label: "Base64 直传",
      body: {
        model: s.imageModel,
        prompt,
        image: rawBase64,
        size: "adaptive",
        response_format: "url",
        watermark: false,
      },
    },
    {
      label: "Base64 返回",
      body: {
        model: s.imageModel,
        prompt,
        image: imageValue,
        size: "adaptive",
        response_format: "b64_json",
        watermark: false,
      },
    },
  ];

  let lastError = "";
  for (const attempt of attempts) {
    const res = await fetch(imageEndpoint(s), {
      method: "POST",
      headers: headers(s),
      body: JSON.stringify(attempt.body),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      lastError = `${attempt.label} -> ${readableApiError(res.status, text)}`;
      continue;
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      lastError = `${attempt.label} -> 返回不是 JSON: ${text.slice(0, 200)}`;
      continue;
    }

    const image = imageFromResponse(data);
    if (image) return image;
    lastError = `${attempt.label} -> 返回中没有图片: ${text.slice(0, 200)}`;
  }

  throw new Error(
    "图生图请求失败。请确认图生图模型是 Seedream 5.0 / SeedEdit 3.0 接入点，并且账号已开通该模型。\n\n" +
      lastError
  );
}
