export type AIItem = {
  title: string;
  detail?: string;
  color?: string;
  parent?: number;
};

export type Settings = {
  brandName: string;
  brandSubtitle: string;
  brandLogo: string;
  productFacts: string;
  mainImageSize: string;
  edgeColorMode: "single" | "multi";
  edgeColor: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  imageModel: string;
  videoModel: string;
};

const SETTINGS_KEY = "ai-infinite-canvas-settings";

export const DEFAULT_EDGE_COLOR = "#69dcff";

export function normalizeEdgeColor(value?: string) {
  const raw = (value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(raw);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return DEFAULT_EDGE_COLOR;
}

export const IMAGE_MODEL_PRESETS = [
  { id: "doubao-seedream-5-0-flash-260915", label: "Doubao-Seedream-5.0-flash" },
  { id: "doubao-seedream-5-0-pro-260628", label: "Doubao-Seedream-5.0-pro" },
  { id: "doubao-seededit-3-0-i2i-250628", label: "Doubao-SeedEdit-3.0-i2i" },
];

export const VIDEO_MODEL_PRESETS = [
  { id: "doubao-seedance-1-0-pro-250528", label: "Seedance 1.0 Pro" },
  { id: "doubao-seedance-1-0-lite-i2v-250428", label: "Seedance 1.0 Lite 图生视频" },
];

const BLACK_BUTTON_FACT =
  "生成图中禁止出现黑色圆形安装固定扣、黑色圆孔、黑色塑料扣或其它黑色圆形件；每片脚垫只展示一个 CHAOPAI 银色品牌徽标扣，黑色固定扣不要画出来。";

const BRAND_BUCKLE_FACT = [
  "全车脚垫品牌卡扣（重点）：每一片毯面上的品牌徽标扣，内容与结构必须统一改成参考图 brand-buckle-chaopai.jpg 的 CHAOPAI 银色圆形金属徽标。",
  "卡扣结构：银色圆形金属徽标嵌入毯面，与毯面基本齐平；外圈同心圆压边；中央横排大写拉丁字母 CHAOPAI，字母为浅凹/浮雕效果，周围有横向分线；右上、左下各有一组斜向双条装饰。",
  "卡扣周围毯面必须完整、贴合紧密，不翘边、不悬空；金属质感为拉丝银色（细腻拉丝、不过分镜面反光），不能改成其它 logo、异形扣、普通塑料扣或旧图里的小圆扣。",
  BLACK_BUTTON_FACT,
  "这是毯面品牌徽标扣，不是脚垫底部的安装固定卡扣；生成时不要展示黑色安装固定扣，全车每一片脚垫（主驾、副驾、后排）的毯面都统一使用该款式。",
].join("\n");

const DEFAULT_PRODUCT_FACTS = [
  "车型：享界 S9/S9T；商品：原车色双层脚垫（上层仿羊绒毯面 + 下层皮革）。",
  "主驾脚垫有矩形防滑脚跟垫，表面斜向菱形压纹，四周包边；防滑垫颜色必须与该款脚垫的毯面颜色完全一致，毯面什么颜色防滑垫就是什么颜色，不固定为某一种颜色。",
  "副驾、后排没有防滑垫，禁止复制到其它位置。防滑垫是脚垫的一部分，不是刹车/油门踏板。",
  "颜色以实拍为准：赤茶橘、琥珀棕、极夜黑、松露棕；每个颜色款的防滑垫都跟随该款毯面颜色。",
  "参考实拍只用于锁定防滑垫的结构、位置和纹理；颜色必须按当前颜色款的毯面取色，不能把参考图的颜色套用到其它颜色款。",
  "如果参考图或生成图中的主驾防滑垫颜色、位置、纹理与实拍不一致，以实拍为准修正；副驾/后排出现防滑垫时必须删除。",
  BRAND_BUCKLE_FACT,
  "禁止改变车型、脚垫片数、轮廓、滑轨、门槛、踏板安全区、logo 和配件数量。",
].join("\n");

const DEFAULTS: Settings = {
  brandName: (import.meta as any).env?.VITE_BRAND_NAME || "AI Workflow",
  brandSubtitle:
    (import.meta as any).env?.VITE_BRAND_SUBTITLE || "图像 · 视频工作流",
  brandLogo: (import.meta as any).env?.VITE_BRAND_LOGO || "",
  productFacts:
    (import.meta as any).env?.VITE_PRODUCT_FACTS || DEFAULT_PRODUCT_FACTS,
  mainImageSize:
    (import.meta as any).env?.VITE_MAIN_IMAGE_SIZE || "1440x1440",
  edgeColorMode:
    (import.meta as any).env?.VITE_EDGE_COLOR_MODE === "single"
      ? "single"
      : "multi",
  edgeColor:
    (import.meta as any).env?.VITE_EDGE_COLOR || DEFAULT_EDGE_COLOR,
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
  videoModel: (import.meta as any).env?.VITE_VIDEO_MODEL || "",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const merged = { ...DEFAULTS, ...saved };
      // 兼容旧版本：旧设置没有 imageModel，且默认文本模型已经失效。
      if (!saved?.imageModel) merged.imageModel = DEFAULTS.imageModel;
      if (!saved?.videoModel) merged.videoModel = DEFAULTS.videoModel;
      if (!saved?.model || saved.model === "doubao-seed-evolving") {
        merged.model = DEFAULTS.model;
      }
      merged.edgeColorMode =
        saved?.edgeColorMode === "single" || saved?.edgeColorMode === "multi"
          ? saved.edgeColorMode
          : DEFAULTS.edgeColorMode;
      merged.edgeColor = normalizeEdgeColor(merged.edgeColor);
      if (
        typeof merged.productFacts === "string" &&
        /深棕色矩形防滑脚跟垫|深棕色绒面/.test(merged.productFacts)
      ) {
        merged.productFacts = DEFAULT_PRODUCT_FACTS;
      }
      if (
        typeof merged.productFacts === "string" &&
        !/CHAOPAI/.test(merged.productFacts)
      ) {
        merged.productFacts = `${merged.productFacts.trim()}\n${BRAND_BUCKLE_FACT}`;
      }
      if (typeof merged.productFacts === "string") {
        merged.productFacts = merged.productFacts.replace(
          /实拍中除品牌徽标扣外的深色小圆扣是安装固定扣[^\n]*/g,
          BLACK_BUTTON_FACT
        );
        if (!/禁止出现黑色圆形安装固定扣/.test(merged.productFacts)) {
          merged.productFacts = `${merged.productFacts.trim()}\n${BLACK_BUTTON_FACT}`;
        }
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
  const base = s.baseUrl.replace(/\/$/, "");
  const localPreview =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(window.location.hostname);
  if (base === "https://ark.cn-beijing.volces.com/api/v3" && localPreview) {
    return "/ark-proxy";
  }
  return base;
}

function chatEndpoint(s: Settings) {
  return apiBase(s) + "/chat/completions";
}

function imageEndpoint(s: Settings) {
  return apiBase(s) + "/images/generations";
}

function videoTasksEndpoint(s: Settings) {
  return apiBase(s) + "/contents/generations/tasks";
}

function headers(s: Settings) {
  return {
    "Content-Type": "application/json",
    ...(s.apiKey?.trim()
      ? { Authorization: `Bearer ${s.apiKey.trim().replace(/^Bearer\s+/i, "")}` }
      : {}),
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

function probeImageDimensions(
  src: string
): Promise<{ width: number; height: number } | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let finished = false;
    const image = new Image();
    const finish = (value: { width: number; height: number } | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 5000);
    image.onload = () =>
      finish({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => finish(null);
    image.src = src;
  });
}

function calculateOutputSize(
  width: number,
  height: number,
  preset: string
): string {
  if (!width || !height) return "2048x2048";
  let outputWidth = width;
  let outputHeight = height;
  let scale = 1;
  if (preset === "2K" || preset === "4K") {
    scale = (preset === "4K" ? 4096 : 2048) / Math.max(width, height);
  }
  outputWidth *= scale;
  outputHeight *= scale;
  const maxSide = Math.max(outputWidth, outputHeight);
  if (maxSide > 4096) {
    const shrink = 4096 / maxSide;
    outputWidth *= shrink;
    outputHeight *= shrink;
  }
  const minSide = Math.min(outputWidth, outputHeight);
  if (minSide > 0 && minSide < 256) {
    const expand = 256 / minSide;
    if (Math.max(outputWidth, outputHeight) * expand <= 4096) {
      outputWidth *= expand;
      outputHeight *= expand;
    }
  }
  const clampSide = (value: number) =>
    Math.max(1, Math.min(4096, Math.round(value)));
  return `${clampSide(outputWidth)}x${clampSide(outputHeight)}`;
}

function parseRequestedSize(value: string): string | null {
  const match = value.trim().match(/^(\d{2,5})\s*[xX×]\s*(\d{2,5})$/);
  if (!match) return null;
  const width = Math.round(Number(match[1]));
  const height = Math.round(Number(match[2]));
  if (width < 256 || height < 256 || width > 4096 || height > 4096) return null;
  return `${width}x${height}`;
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
  const selectedSize = size || "adaptive";
  const sourceDimensions = await probeImageDimensions(rawInputs[0]);
  const requestedSize = parseRequestedSize(selectedSize);
  const primarySize =
    requestedSize ||
    (sourceDimensions
      ? calculateOutputSize(sourceDimensions.width, sourceDimensions.height, selectedSize)
      : "2048x2048");
  const sizeCandidates = Array.from(
    new Set([primarySize, "2048x2048", "1024x1024", ""])
  );

  const attempts: ImageAttempt[] = sizeCandidates.map((candidateSize) => ({
    label: candidateSize ? `尺寸 ${candidateSize}` : "服务端默认尺寸",
    body: {
      model: s.imageModel,
      prompt,
      image: imageValue,
      ...(candidateSize ? { size: candidateSize } : {}),
      response_format: "url",
      watermark: false,
    },
  }));
  attempts.push({
    label: `Base64 返回（尺寸 ${primarySize}）`,
    body: {
      model: s.imageModel,
      prompt,
      image: imageValue,
      size: primarySize,
      response_format: "b64_json",
      watermark: false,
    },
  });

  let lastError = "";
  for (const attempt of attempts) {
    let res: Response;
    try {
      res = await fetch(imageEndpoint(s), {
        method: "POST",
        headers: headers(s),
        body: JSON.stringify(attempt.body),
      });
    } catch (error: any) {
      const detail = String(error?.message || error);
      throw new Error(
        `无法连接火山方舟 API：${detail}\n\n` +
          "请确认电脑可以访问 ark.cn-beijing.volces.com，并检查 VPN、代理或防火墙。\n" +
          "如果使用本地画布，请关闭之前的命令行窗口，重新运行 start-canvas.bat；新版会通过本地代理请求方舟，避免浏览器跨域拦截。"
      );
    }

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const message = `${attempt.label} -> ${readableApiError(res.status, text)}`;
      if ([401, 403, 404, 429].includes(res.status)) throw new Error(message);
      lastError = message;
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

export type VideoMode = "image" | "edit";

export type VideoGenerationOptions = {
  mode: VideoMode;
  prompt: string;
  imageUrls?: string[];
  videoUrl?: string;
  resolution?: string;
  ratio?: string;
  duration?: number;
  generateAudio?: boolean;
  watermark?: boolean;
};

export type VideoTaskState = {
  id: string;
  status: string;
  videoUrl?: string;
  error?: string;
  raw?: any;
};

type VideoContentItem = {
  type: "text" | "image_url" | "video_url";
  text?: string;
  image_url?: { url: string };
  video_url?: { url: string };
  role?: string;
};

function buildVideoContent(
  options: VideoGenerationOptions,
  includeRoles: boolean,
  includeAudioFlag: boolean
): VideoContentItem[] {
  const prompt = options.prompt.trim();
  const flags = [
    prompt,
    options.resolution ? `--resolution ${options.resolution}` : "",
    options.ratio ? `--ratio ${options.ratio}` : "",
    options.duration ? `--duration ${options.duration}` : "",
    typeof options.generateAudio === "boolean" && includeAudioFlag
      ? `--generate_audio ${options.generateAudio}`
      : "",
    `--watermark ${options.watermark ? "true" : "false"}`,
  ].filter(Boolean);

  const content: VideoContentItem[] = [{ type: "text", text: flags.join(" ") }];
  const imageUrls = (options.imageUrls || []).filter(Boolean);

  if (options.mode === "edit") {
    if (options.videoUrl?.trim()) {
      content.push({
        type: "video_url",
        video_url: { url: options.videoUrl.trim() },
        ...(includeRoles ? { role: "reference_video" } : {}),
      });
    }
    for (const url of imageUrls) {
      content.push({
        type: "image_url",
        image_url: { url },
        ...(includeRoles ? { role: "reference_image" } : {}),
      });
    }
    return content;
  }

  imageUrls.forEach((url, index) => {
    content.push({
      type: "image_url",
      image_url: { url },
      ...(includeRoles
        ? { role: index === 0 ? "first_frame" : "reference_image" }
        : {}),
    });
  });
  return content;
}

function parseVideoTask(data: any): VideoTaskState {
  const root =
    data?.data && (data.data.id || data.data.status || data.data.content)
      ? data.data
      : data;
  const content = root?.content ?? root?.output ?? {};
  const videoUrl =
    content?.video_url ||
    content?.video?.url ||
    content?.url ||
    root?.video_url ||
    root?.output?.video_url ||
    root?.result?.video_url ||
    data?.data?.video_url ||
    data?.data?.content?.video_url;
  const error =
    root?.error?.message ||
    root?.error?.code ||
    root?.failure_reason ||
    root?.message ||
    root?.error;
  return {
    id: String(root?.id || root?.task_id || ""),
    status: String(root?.status || "").toLowerCase(),
    videoUrl: typeof videoUrl === "string" && videoUrl ? videoUrl : undefined,
    error: error ? String(error) : undefined,
    raw: data,
  };
}

async function requestVideoTask(
  s: Settings,
  body: any,
  signal?: AbortSignal
): Promise<VideoTaskState> {
  const res = await fetch(videoTasksEndpoint(s), {
    method: "POST",
    headers: headers(s),
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    const error = new Error(readableApiError(res.status, text)) as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`视频任务返回不是 JSON：${text.slice(0, 240)}`);
  }
  const task = parseVideoTask(data);
  if (!task.id) {
    throw new Error(`视频任务创建成功但没有返回任务 ID：${text.slice(0, 240)}`);
  }
  return task;
}

export async function createVideoTask(
  options: VideoGenerationOptions,
  s: Settings,
  signal?: AbortSignal
): Promise<VideoTaskState> {
  if (!s.videoModel) {
    throw new Error(
      "请先在 ⚙ 设置里填写 Seedance 视频模型 ID 或 ep-... 推理接入点。"
    );
  }
  if (!options.prompt?.trim()) {
    throw new Error("视频提示词不能为空。");
  }
  if (options.mode === "image" && !(options.imageUrls || []).length) {
    throw new Error("图生视频至少需要连接一张参考图。");
  }
  if (options.mode === "edit" && !options.videoUrl?.trim()) {
    throw new Error("视频编辑需要连接一个上游视频，或填写公网视频 URL。");
  }

  const attempts = [
    { label: "标准格式", includeRoles: true, includeAudioFlag: true },
    { label: "兼容格式（无 role）", includeRoles: false, includeAudioFlag: true },
    { label: "兼容格式（无音频参数）", includeRoles: false, includeAudioFlag: false },
  ];
  let lastError = "";

  for (const attempt of attempts) {
    try {
      return await requestVideoTask(
        s,
        {
          model: s.videoModel,
          content: buildVideoContent(
            options,
            attempt.includeRoles,
            attempt.includeAudioFlag
          ),
        },
        signal
      );
    } catch (error: any) {
      if (error?.name === "AbortError") throw error;
      const status = Number(error?.status || 0);
      lastError = `${attempt.label} -> ${error?.message || error}`;
      if (status && ![400, 422].includes(status)) throw error;
    }
  }

  throw new Error(
    "视频任务创建失败。请确认视频模型/接入点已开通，且参考图或视频 URL 可被方舟访问。\n\n" +
      lastError
  );
}

export async function getVideoTask(
  taskId: string,
  s: Settings,
  signal?: AbortSignal
): Promise<VideoTaskState> {
  const res = await fetch(`${videoTasksEndpoint(s)}/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: headers(s),
    signal,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    const error = new Error(readableApiError(res.status, text)) as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`视频任务状态返回不是 JSON：${text.slice(0, 240)}`);
  }
  return parseVideoTask(data);
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("已取消", "AbortError"));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("已取消", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const VIDEO_FAILED_STATUSES = ["failed", "cancelled", "canceled", "expired"];

export async function waitForVideoTask(
  taskId: string,
  s: Settings,
  onUpdate?: (task: VideoTaskState) => void,
  signal?: AbortSignal
): Promise<VideoTaskState> {
  const startedAt = Date.now();
  const timeoutMs = 20 * 60 * 1000;
  let delay = 3000;
  let transientErrors = 0;

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) throw new DOMException("已取消", "AbortError");
    let task: VideoTaskState;
    try {
      task = await getVideoTask(taskId, s, signal);
      transientErrors = 0;
    } catch (error: any) {
      if (error?.name === "AbortError") throw error;
      const status = Number(error?.status || 0);
      const retryable = !status || status === 404 || status === 429 || status >= 500;
      transientErrors += 1;
      if (!retryable || transientErrors > 3) throw error;
      await wait(delay, signal);
      delay = Math.min(8000, Math.round(delay * 1.25));
      continue;
    }
    onUpdate?.(task);
    if (task.videoUrl) return task;
    if (task.status === "succeeded" || task.status === "success") {
      throw new Error("视频任务已完成，但返回中没有视频 URL。");
    }
    if (VIDEO_FAILED_STATUSES.includes(task.status)) {
      throw new Error(task.error || `视频任务状态：${task.status || "失败"}`);
    }
    await wait(delay, signal);
    delay = Math.min(8000, Math.round(delay * 1.25));
  }

  throw new Error("视频任务等待超时（20 分钟）。任务可能仍在后台运行，请稍后重试。");
}

export async function generateVideo(
  options: VideoGenerationOptions,
  s: Settings,
  onUpdate?: (task: VideoTaskState) => void,
  signal?: AbortSignal
): Promise<VideoTaskState> {
  const created = await createVideoTask(options, s, signal);
  onUpdate?.(created);
  if (created.videoUrl) return created;
  if (VIDEO_FAILED_STATUSES.includes(created.status)) {
    throw new Error(created.error || `视频任务状态：${created.status}`);
  }
  return waitForVideoTask(created.id, s, onUpdate, signal);
}
