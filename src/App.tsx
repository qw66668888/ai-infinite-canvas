import { useCallback, useEffect, useRef, useState } from "react";
import {
  AssetRecordType,
  Tldraw,
  createShapeId,
  toRichText,
  type Editor,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import {
  editImage,
  generateNotes,
  IMAGE_MODEL_PRESETS,
  loadSettings,
  rewriteText,
  saveSettings,
  type AIItem,
  type Settings,
} from "./ai";

const COLORS = ["blue", "green", "yellow", "orange", "violet", "grey", "red"];
const NOTE_SIZE = 200;
const GAP_X = 48;
const GAP_Y = 40;

const EXAMPLES = [
  "SaaS MVP 八周上线计划",
  "一款理财 App 的用户调研访谈提纲",
  "个人 AI 品牌的内容选题支柱",
  "分析某产品的 SWOT",
];

function safeColor(c?: string) {
  return COLORS.includes(c ?? "") ? c : "yellow";
}

function richTextToPlain(rt: any): string {
  if (!rt || !Array.isArray(rt.content)) return "";
  return rt.content
    .map((block: any) =>
      Array.isArray(block?.content)
        ? block.content.map((n: any) => n?.text ?? "").join("")
        : ""
    )
    .join("\n")
    .trim();
}

function truncate(text: string, n = 42) {
  return text.length > n ? text.slice(0, n) + "…" : text;
}

function edgePoint(cx: number, cy: number, tx: number, ty: number) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? NOTE_SIZE / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? NOTE_SIZE / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return { x: cx + dx * t, y: cy + dy * t };
}

async function fileToDataUrl(file: File, maxDim = 4096): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择 JPG、PNG 或 WebP 图片。");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(new Error("读取图片失败"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("图片解码失败"));
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const tooLargeForApi = dataUrl.length > 7_500_000;
  if (scale >= 1 && !tooLargeForApi) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  const useJpeg = tooLargeForApi || file.size > 6 * 1024 * 1024 || file.type !== "image/png";
  if (useJpeg) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(useJpeg ? "image/jpeg" : "image/png", 0.95);
}

async function getImageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("无法读取生成图片的尺寸"));
    img.src = src;
  });
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(meta)?.[1] || "image/png";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export function App() {
  const editorRef = useRef<Editor | null>(null);
  const unsubRef = useRef<null | (() => void)>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<"notes" | "image">("image");
  const [prompt, setPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [draft, setDraft] = useState<Settings>(settings);
  const [selected, setSelected] = useState<{ id: any; text: string }[]>([]);
  const [shapeCount, setShapeCount] = useState(0);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState("adaptive");

  const syncState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const notes = editor
      .getSelectedShapes()
      .filter((s) => s.type === "note")
      .map((s: any) => ({ id: s.id, text: richTextToPlain(s.props?.richText) }));
    setSelected(notes);
    setShapeCount(editor.getCurrentPageShapes().length);
  }, []);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  const putNotes = useCallback((items: AIItem[], links = true) => {
    const editor = editorRef.current;
    if (!editor || items.length === 0) return;

    const b = editor.getViewportPageBounds();
    const center = { x: b.minX + b.w / 2, y: b.minY + b.h / 2 };
    const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(items.length))));
    const totalW = cols * NOTE_SIZE + (cols - 1) * GAP_X;
    const startX = center.x - totalW / 2;
    const startY = center.y - 220;

    const noteShapes: any[] = [];
    const noteIds: any[] = [];
    const placed: { x: number; y: number }[] = [];
    const colY: number[] = new Array(cols).fill(startY);

    items.forEach((item, i) => {
      const col = i % cols;
      const x = startX + col * (NOTE_SIZE + GAP_X);
      const y = colY[col];
      colY[col] += NOTE_SIZE + GAP_Y;
      placed.push({ x, y });
      const id = createShapeId();
      noteIds.push(id);
      const text = item.detail ? `${item.title}\n\n${item.detail}` : item.title;
      noteShapes.push({
        id,
        type: "note",
        x,
        y,
        props: {
          richText: toRichText(text),
          color: safeColor(item.color),
          size: "m",
          growY: 0,
        },
      });
    });

    const arrowShapes: any[] = [];
    if (links) {
      items.forEach((item, i) => {
        const p = item.parent;
        if (typeof p !== "number" || p < 1 || p > i) return;
        const from = placed[p - 1];
        const to = placed[i];
        const fcx = from.x + NOTE_SIZE / 2;
        const fcy = from.y + NOTE_SIZE / 2;
        const tcx = to.x + NOTE_SIZE / 2;
        const tcy = to.y + NOTE_SIZE / 2;
        const s = edgePoint(fcx, fcy, tcx, tcy);
        const e = edgePoint(tcx, tcy, fcx, fcy);
        arrowShapes.push({
          id: createShapeId(),
          type: "arrow",
          x: s.x,
          y: s.y,
          props: {
            kind: "arc",
            color: "grey",
            dash: "solid",
            size: "m",
            fill: "none",
            arrowheadStart: "none",
            arrowheadEnd: "arrow",
            font: "draw",
            start: { x: 0, y: 0 },
            end: { x: e.x - s.x, y: e.y - s.y },
            bend: 0,
            text: "",
            labelPosition: 0.5,
            scale: 1,
            elbowMidPoint: 0.5,
          },
        });
      });
    }

    editor.run(() => {
      editor.createShapes([...noteShapes, ...arrowShapes]);
      editor.selectNone();
      editor.select(...noteIds);
      editor.zoomToSelection({ animation: { duration: 350 } });
    });
    syncState();
  }, [syncState]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const items = await generateNotes(prompt, settings);
      if (items.length === 0) throw new Error("模型没有返回任何便签。");
      putNotes(items);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [prompt, busy, settings, putNotes]);

  const handleSummarize = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || busy) return;
    const notes = editor
      .getSelectedShapes()
      .filter((s) => s.type === "note")
      .map((s: any) => richTextToPlain(s.props?.richText))
      .filter(Boolean);
    if (notes.length < 2) {
      setError("请先框选至少两张便签，再点击“总结选中”。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const merged =
        "请把下面这些便签总结并重新整理成更清晰的结构，用简体中文返回。便签内容：\n- " +
        notes.join("\n- ");
      const items = await generateNotes(merged, settings);
      putNotes(items, false);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, settings, putNotes]);

  const handleRewrite = useCallback(
    async (instruction: string) => {
      const editor = editorRef.current;
      if (!editor || busy) return;
      const notes = editor.getSelectedShapes().filter((s) => s.type === "note");
      if (notes.length !== 1) {
        setError("请先选中一张便签，再使用这个操作。");
        return;
      }
      const shape: any = notes[0];
      const text = richTextToPlain(shape.props?.richText);
      if (!text) {
        setError("这张便签还没有文字内容。");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await rewriteText(text, instruction, settings);
        if (!result) throw new Error("模型没有返回内容。");
        editor.updateShape({
          id: shape.id,
          type: "note",
          props: { richText: toRichText(result) },
        } as any);
        syncState();
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, settings, syncState]
  );

  const handleExport = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || busy) return;
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) {
      setError("画布还是空的，先生成一些内容吧。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { blob } = await editor.toImage(shapes, {
        format: "png",
        background: true,
        padding: 48,
        pixelRatio: 2,
      } as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AI画布-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e: any) {
      setError("导出失败：" + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const handleClear = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!confirm("确定清空当前画布上的所有内容吗？")) return;
    editor.deleteShapes(editor.getCurrentPageShapes().map((s) => s.id));
    syncState();
  }, [syncState]);

  const handleZoomFit = useCallback(() => {
    editorRef.current?.zoomToFit({ animation: { duration: 300 } });
  }, []);

  const handlePickFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageSrc(dataUrl);
      setImageResult(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  const handleUseSelectedImage = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const shape: any = editor
      .getSelectedShapes()
      .find((s) => s.type === "image");
    if (!shape) {
      setError("请先在画布上选中一张图片（点一下那张图）。");
      return;
    }
    setError(null);
    try {
      const asset: any = editor.getAsset(shape.props?.assetId);
      const src: string | null = asset?.props?.src ?? null;
      if (!src) throw new Error("这张图片没有可读取的源文件。");
      if (src.startsWith("data:")) {
        setImageSrc(src);
      } else {
        try {
          const blob = await (await fetch(src)).blob();
          const file = new File([blob], "selected-image.png", {
            type: blob.type || "image/png",
          });
          setImageSrc(await fileToDataUrl(file));
        } catch {
          if (!src.startsWith("http")) {
            throw new Error("这张图片是本机临时文件，无法发送给云端模型。");
          }
          // 公开图片地址可以直接交给方舟读取，避免浏览器跨域下载失败。
          setImageSrc(src);
        }
      }
      setImageResult(null);
    } catch (e: any) {
      setError("读取选中图片失败：" + (e?.message ?? String(e)));
    }
  }, []);

  const handleImageGenerate = useCallback(async () => {
    if (busy) return;
    if (!imageSrc) {
      setError("请先上传一张图片，或选中画布上的图片后点“用选中图片”。");
      return;
    }
    if (!imagePrompt.trim()) {
      setError("请输入改图指令，例如“把毯面颜色改成白色星空毯”。");
      return;
    }
    if (!settings.imageModel) {
      setError("请先在 ⚙ 里填写图生图模型（SeedEdit 或 Seedream 的接入点 ID）。");
      setSettingsOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await editImage(imageSrc, imagePrompt, settings, imageSize);
      setImageResult(result);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, imageSrc, imagePrompt, settings, imageSize]);

  const handleDownloadResult = useCallback(async () => {
    if (!imageResult) return;
    try {
      let url = imageResult;
      if (!imageResult.startsWith("data:")) {
        const blob = await (await fetch(imageResult)).blob();
        url = URL.createObjectURL(blob);
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `AI改图-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (url.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch {
      window.open(imageResult, "_blank");
    }
  }, [imageResult]);

  const handlePlaceOnCanvas = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !imageResult) return;
    try {
      let file: File | null = null;
      if (imageResult.startsWith("data:")) {
        file = dataUrlToFile(imageResult, `AI改图-${Date.now()}.png`);
      } else {
        try {
          const blob = await (await fetch(imageResult)).blob();
          file = new File([blob], `AI改图-${Date.now()}.png`, {
            type: blob.type || "image/png",
          });
        } catch {
          // 部分对象存储不允许浏览器跨域读取；仍然可以把远程图片直接放到画布。
          file = null;
        }
      }
      const b = editor.getViewportPageBounds();
      const center = { x: b.minX + b.w / 2, y: b.minY + b.h / 2 };
      if (file) {
        await editor.putExternalContent({
          type: "files",
          files: [file],
          point: center,
        } as any);
        editor.zoomToFit({ animation: { duration: 300 } });
      } else {
        const { w, h } = await getImageSize(imageResult);
        const assetId = AssetRecordType.createId();
        const scale = Math.min(1, 720 / Math.max(w, h));
        const width = Math.max(1, Math.round(w * scale));
        const height = Math.max(1, Math.round(h * scale));
        const shapeId = createShapeId();
        editor.run(() => {
          editor.createAssets([
            {
              id: assetId,
              type: "image",
              typeName: "asset",
              props: {
                name: "AI改图.png",
                src: imageResult,
                w,
                h,
                mimeType: "image/png",
                isAnimated: false,
              },
              meta: {},
            } as any,
          ]);
          editor.createShape({
            id: shapeId,
            type: "image",
            x: center.x - width / 2,
            y: center.y - height / 2,
            props: { assetId, w: width, h: height },
          } as any);
          editor.select(shapeId);
          editor.zoomToSelection({ animation: { duration: 300 } });
        });
      }
      setError(null);
    } catch (e: any) {
      setError("放到画布失败：" + (e?.message ?? String(e)));
    }
  }, [imageResult]);

  const saveDraft = () => {
    saveSettings(draft);
    setSettings(draft);
    setSettingsOpen(false);
    setError(null);
  };

  return (
    <div className="app">
      <Tldraw
        persistenceKey="ai-infinite-canvas"
        onMount={(editor) => {
          editorRef.current = editor;
          editor.user.updateUserPreferences({ locale: "zh-cn" });
          unsubRef.current?.();
          unsubRef.current = editor.store.listen(() => syncState());
          syncState();
        }}
      />

      <div className="panel">
        <div className="brand">
          <span className="logo-dot" />
          <strong>AI 图生图画布</strong>
          <button
            className="gear"
            title="模型设置"
            onClick={() => {
              setDraft(settings);
              setSettingsOpen((v) => !v);
            }}
          >
            ⚙
          </button>
        </div>

        {!settingsOpen && (
          <div className="tabs">
            <button
              className={mode === "image" ? "tab active" : "tab"}
              onClick={() => {
                setMode("image");
                setError(null);
              }}
            >
              图生图（改图）
            </button>
            <button
              className={mode === "notes" ? "tab active" : "tab"}
              onClick={() => {
                setMode("notes");
                setError(null);
              }}
            >
              AI 卡片（附加）
            </button>
          </div>
        )}

        {settingsOpen ? (
          <div className="settings">
            <label>接口地址 Base URL（OpenAI 兼容）</label>
            <input
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              placeholder="https://.../api/v3"
            />
            <label>API Key</label>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="在此粘贴密钥"
            />
            <label>图生图模型（改图必填）</label>
            <input
              list="image-model-presets"
              value={draft.imageModel}
              onChange={(e) => setDraft({ ...draft, imageModel: e.target.value })}
              placeholder="ep-xxxxxxxx 或 doubao-seedream-5-0-flash-260915"
            />
            <datalist id="image-model-presets">
              {IMAGE_MODEL_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </datalist>
            <label>文本模型（仅 AI 卡片需要）</label>
            <input
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder="文本模型或接入点 ID"
            />
            <div className="row">
              <button className="primary" onClick={saveDraft}>
                保存
              </button>
              <button onClick={() => setSettingsOpen(false)}>取消</button>
            </div>
            <div className="hint">
              改图请优先填 Seedream 5.0 Flash / Pro 接入点；Seedream 同时支持文生图和图生图。
              模型输入框点一下可从常用模型里选。
            </div>
          </div>
        ) : mode === "notes" ? (
          <>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
              placeholder="描述一个主题或计划，AI 会自动拆成便签并连线……"
              rows={4}
            />
            <div className="chips">
              {EXAMPLES.map((x) => (
                <button key={x} className="chip" onClick={() => setPrompt(x)}>
                  {x}
                </button>
              ))}
            </div>
            <div className="row">
              <button
                className="primary"
                disabled={busy || !prompt.trim()}
                onClick={handleGenerate}
              >
                {busy ? "生成中…" : "生成"}
              </button>
              <button disabled={busy} onClick={handleSummarize}>
                总结选中
              </button>
            </div>

            <div className="status">
              <span className="dot" />
              {selected.length > 0
                ? `已选中 ${selected.length} 张便签`
                : shapeCount > 0
                ? `画布共 ${shapeCount} 个元素`
                : "画布还是空的"}
            </div>

            {selected.length === 1 && (
              <div className="selbox">
                <div className="seltext">「{truncate(selected[0].text)}」</div>
                <div className="actions">
                  <button disabled={busy} onClick={() => handleRewrite("请把这段内容扩写得更具体，补充关键细节，保持简洁。")}>
                    扩写
                  </button>
                  <button disabled={busy} onClick={() => handleRewrite("请把这段内容精简成一句更凝练的话。")}>
                    精简
                  </button>
                  <button disabled={busy} onClick={() => handleRewrite("请翻译成地道的英文。")}>
                    译英
                  </button>
                </div>
              </div>
            )}

            <div className="actions">
              <button onClick={handleZoomFit}>全览</button>
              <button disabled={busy} onClick={handleExport}>
                导出 PNG
              </button>
              <button onClick={handleClear}>清空</button>
            </div>

            <div className="hint">Ctrl/⌘ + 回车 生成 · 拖拽编辑 · 框选多张后总结</div>
          </>
        ) : (
          <>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleImageGenerate();
                }
              }}
              placeholder="描述要怎么改这张图，例如：把毯面颜色改成白色星空毯，其余内容结构保持不变……"
              rows={5}
            />
            <div className="row">
              <button onClick={() => fileInputRef.current?.click()}>
                上传图片
              </button>
              <button onClick={handleUseSelectedImage}>用选中图片</button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
            />

            <div
              className={imageSrc ? "preview" : "preview empty-preview"}
              onClick={() => {
                if (!imageSrc) fileInputRef.current?.click();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handlePickFile(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              {imageSrc ? (
                <>
                  <img src={imageSrc} alt="原图" />
                  <div className="preview-meta">
                    <span>原图</span>
                    <button
                      className="linkbtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      更换
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <strong>点击上传原图</strong>
                  <br />
                  也可以把图片拖到这里，或选中画布上的图片后点“用选中图片”
                </div>
              )}
            </div>

            <div className="row sizerow">
              <span className="sizelabel">输出尺寸</span>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
              >
                <option value="adaptive">保持原图比例</option>
                <option value="2K">2K</option>
                <option value="4K">4K（平台最高）</option>
              </select>
            </div>

            <button
              className="primary"
              disabled={busy || !imageSrc || !imagePrompt.trim()}
              onClick={handleImageGenerate}
            >
              {busy ? "正在改图…" : "开始改图"}
            </button>

            {imageResult && (
              <div className="resultbox">
                <img src={imageResult} alt="生成结果" />
                <div className="result-label">改图结果</div>
                <div className="row">
                  <button onClick={handleDownloadResult}>下载</button>
                  <button className="primary" onClick={handlePlaceOnCanvas}>
                    放到画布
                  </button>
                </div>
              </div>
            )}

            <div className="hint">
              改图会保留原图比例，只按你的指令修改指定内容；平台最高 4K，
              需要 8K 可下载后再无损放大。Ctrl/⌘ + 回车 开始改图。
            </div>
          </>
        )}

        {busy && <div className="busy">AI 正在处理，请稍候…</div>}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
